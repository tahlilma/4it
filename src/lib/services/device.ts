// ZKTeco punch-machine integration (TCP/UDP 4370) via zkteco-js:
//  * pull attendance logs   * enrol employees   * remove separated employees   * sync the device clock
// Device clocks are wall-clock; the library returns JS Dates built in server-local time, so we read
// the local components to obtain the factory's naive wall-clock time regardless of server timezone.

import type { PrismaClient } from "@/generated/prisma/client";
import Zkteco, { type ZkUser } from "zkteco-js";
import { importPunches, type ImportResult, type ParsedPunch } from "./punches";

const TIMEOUT_MS = 10_000;
const MAX_UID = 3000; // zkteco-js accepts device slots 1–3000

interface DeviceRow {
  id: number;
  ip: string;
  port: number;
}

/** zkteco-js rejects with its own (sometimes nested) error objects ({ err, command }), not Errors. */
function errText(e: unknown): string {
  let z = e as { err?: unknown; message?: string; code?: string } | undefined;
  for (let i = 0; i < 5 && z && typeof z === "object" && "err" in z && z.err; i++) z = z.err as typeof z;
  const code = z?.code;
  if (code === "ECONNREFUSED") return "connection refused (check the IP / port and that the device is on)";
  if (code === "ETIMEDOUT" || code === "EHOSTUNREACH" || /timed? ?out/i.test(z?.message ?? "")) return "no response from device (network unreachable or wrong IP)";
  if (code === "ECONNRESET") return "another program is connected to the device";
  return z?.message || code || String(e);
}

async function withDevice<T>(dev: DeviceRow, fn: (zk: Zkteco) => Promise<T>): Promise<T> {
  const zk = new Zkteco(dev.ip, dev.port, TIMEOUT_MS, 5000 + (dev.id % 1000));
  try {
    await zk.createSocket();
  } catch (e) {
    throw new Error(`Cannot connect to device ${dev.ip}:${dev.port} — ${errText(e)}`);
  }
  try {
    return await fn(zk);
  } catch (e) {
    throw new Error(`Device ${dev.ip}: ${errText(e)}`);
  } finally {
    try {
      await zk.disconnect();
    } catch {
      // ignore
    }
  }
}

const naiveFromLocal = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));

const localFromNaive = (n: Date) =>
  new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds());

async function note(db: PrismaClient, id: number, text: string) {
  await db.device.update({ where: { id }, data: { lastSyncAt: new Date(), lastSyncNote: text.slice(0, 300) } });
}

export async function pullDeviceLogs(db: PrismaClient, deviceId: number, userName: string): Promise<ImportResult> {
  const dev = await db.device.findUniqueOrThrow({ where: { id: deviceId } });
  const records = await withDevice(dev, async (zk) => (await zk.getAttendances()).data ?? []);
  const punches: ParsedPunch[] = [];
  for (const r of records) {
    const id = parseInt(String(r.user_id).trim(), 10);
    const t = new Date(r.record_time);
    if (!Number.isFinite(id) || id <= 0 || Number.isNaN(t.getTime())) continue;
    punches.push({ punchId: id, time: naiveFromLocal(t) });
  }
  const res = await importPunches(db, punches, { source: "DEVICE", deviceId, createdBy: userName });
  await note(db, deviceId, `Pulled ${records.length} logs, ${res.inserted} new`);
  return res;
}

export async function readDeviceUsers(db: PrismaClient, deviceId: number): Promise<ZkUser[]> {
  const dev = await db.device.findUniqueOrThrow({ where: { id: deviceId } });
  return withDevice(dev, async (zk) => (await zk.getUsers()).data ?? []);
}

/** Enrol employees (by punch ID) on the device and record the enrolment. */
export async function pushEmployees(db: PrismaClient, deviceId: number, employeeIds: number[]): Promise<{ added: number; skipped: number }> {
  const dev = await db.device.findUniqueOrThrow({ where: { id: deviceId } });
  const emps = await db.employee.findMany({ where: { id: { in: employeeIds }, status: "ACTIVE" }, select: { id: true, punchId: true, nameEn: true } });
  const result = await withDevice(dev, async (zk) => {
    const users = (await zk.getUsers()).data ?? [];
    const byUserId = new Map(users.map((u) => [String(u.userId).trim(), u]));
    let nextUid = users.reduce((m, u) => Math.max(m, u.uid), 0) + 1;
    let added = 0, skipped = 0;
    for (const e of emps) {
      if (byUserId.has(String(e.punchId))) {
        skipped++;
        continue;
      }
      if (nextUid > MAX_UID) throw new Error("Device user capacity reached (3000).");
      await zk.setUser(nextUid++, String(e.punchId), e.nameEn.slice(0, 24), "", 0, 0);
      added++;
    }
    return { added, skipped };
  });
  for (const e of emps) {
    await db.employeeDevice.upsert({
      where: { employeeId_deviceId: { employeeId: e.id, deviceId } },
      create: { employeeId: e.id, deviceId },
      update: { removedAt: null, enrolledAt: new Date() },
    });
  }
  await note(db, deviceId, `Enrolled ${result.added}, already present ${result.skipped}`);
  return result;
}

/** Remove employees from the device (separated staff must lose access — C-TPAT personnel security). */
export async function removeEmployees(db: PrismaClient, deviceId: number, employeeIds: number[]): Promise<{ removed: number; notFound: number }> {
  const dev = await db.device.findUniqueOrThrow({ where: { id: deviceId } });
  const emps = await db.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, punchId: true } });
  const result = await withDevice(dev, async (zk) => {
    const users = (await zk.getUsers()).data ?? [];
    const byUserId = new Map(users.map((u) => [String(u.userId).trim(), u]));
    let removed = 0, notFound = 0;
    for (const e of emps) {
      const u = byUserId.get(String(e.punchId));
      if (!u) {
        notFound++;
        continue;
      }
      await zk.deleteUser(u.uid);
      removed++;
    }
    return { removed, notFound };
  });
  await db.employeeDevice.updateMany({ where: { deviceId, employeeId: { in: employeeIds }, removedAt: null }, data: { removedAt: new Date() } });
  await note(db, deviceId, `Removed ${result.removed}, not on device ${result.notFound}`);
  return result;
}

/** Re-read the device user list and align enrolment records with it. */
export async function reconcileEnrollments(db: PrismaClient, deviceId: number): Promise<{ enrolled: number; missing: number }> {
  const users = await readDeviceUsers(db, deviceId);
  const onDevice = new Set(users.map((u) => parseInt(String(u.userId).trim(), 10)));
  const emps = await db.employee.findMany({ select: { id: true, punchId: true } });
  let enrolled = 0, missing = 0;
  for (const e of emps) {
    if (onDevice.has(e.punchId)) {
      await db.employeeDevice.upsert({
        where: { employeeId_deviceId: { employeeId: e.id, deviceId } },
        create: { employeeId: e.id, deviceId },
        update: { removedAt: null },
      });
      enrolled++;
    } else {
      const r = await db.employeeDevice.updateMany({ where: { employeeId: e.id, deviceId, removedAt: null }, data: { removedAt: new Date() } });
      missing += r.count;
    }
  }
  await note(db, deviceId, `Reconciled: ${enrolled} on device`);
  return { enrolled, missing };
}

/** Set the device clock to the factory's current wall-clock time. */
export async function syncDeviceClock(db: PrismaClient, deviceId: number, nowNaive: Date): Promise<void> {
  const dev = await db.device.findUniqueOrThrow({ where: { id: deviceId } });
  await withDevice(dev, (zk) => zk.setTime(localFromNaive(nowNaive)));
  await note(db, deviceId, "Clock synchronised");
}

export async function deviceInfo(db: PrismaClient, deviceId: number) {
  const dev = await db.device.findUniqueOrThrow({ where: { id: deviceId } });
  return withDevice(dev, async (zk) => {
    const info = await zk.getInfo();
    const time = await zk.getTime();
    return { ...info, time: naiveFromLocal(new Date(time)) };
  });
}
