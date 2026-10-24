"use server";

import { refresh } from "next/cache";
import { FieldErrors, runAction, type FormState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { actionUser } from "@/lib/auth";
import { addDays, addMinutes, dateOnly, diffDays, dmy, parseDate, parseHm, todayLocal, toLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { processAttendance } from "@/lib/services/attendance";
import { deviceInfo, pullDeviceLogs, pushEmployees, reconcileEnrollments, removeEmployees, syncDeviceClock } from "@/lib/services/device";
import { importPunches, parseAttendanceText } from "@/lib/services/punches";

const MAX_RANGE_DAYS = 400;

export async function processRange(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("attendance.process");
    const from = parseDate(String(fd.get("from") ?? ""));
    const to = parseDate(String(fd.get("to") ?? ""));
    const errors: Record<string, string> = {};
    if (!from) errors.from = "Required";
    if (!to) errors.to = "Required";
    if (from && to && to < from) errors.to = "Must be on or after the start date";
    if (from && to && diffDays(from, to) > MAX_RANGE_DAYS) errors.to = `At most ${MAX_RANGE_DAYS} days at a time`;
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    const company = await prisma.company.findFirstOrThrow();
    const today = todayLocal(company.tzOffsetMinutes);
    const end = to! > today ? today : to!;
    const dept = Number(fd.get("dept") ?? 0);
    const employeeIds = dept ? (await prisma.employee.findMany({ where: { departmentId: dept }, select: { id: true } })).map((e) => e.id) : undefined;
    const locked = await prisma.payrollRun.findFirst({
      where: {
        status: "LOCKED",
        OR: monthsTouched(from!, end).map(([year, month]) => ({ year, month })),
      },
    });
    if (locked) return { ok: false, error: `Payroll for ${locked.month}/${locked.year} is locked; attendance for that month can't be re-processed. Unlock the payroll first.` };
    const r = await processAttendance(prisma, { from: from!, to: end, employeeIds });
    await audit(user, "PROCESS", "Attendance", "", `Processed attendance ${dmy(from!)} – ${dmy(end)}${dept ? ` (department ${dept})` : ""}: ${r.employees} employees, ${r.days} days`);
    refresh();
    return { ok: true, message: `Processed ${r.days.toLocaleString("en-IN")} employee-days for ${r.employees} employees (${dmy(from!)} – ${dmy(end)}).` };
  });
}

function monthsTouched(from: Date, to: Date): [number, number][] {
  const out: [number, number][] = [];
  let y = from.getUTCFullYear(), m = from.getUTCMonth() + 1;
  while (y * 12 + m <= to.getUTCFullYear() * 12 + to.getUTCMonth() + 1) {
    out.push([y, m]);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

async function ensureMonthOpen(date: Date) {
  const run = await prisma.payrollRun.findUnique({ where: { year_month: { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 } } });
  if (run?.status === "LOCKED") throw new FieldErrors({ date: `Payroll for ${run.month}/${run.year} is locked — attendance for that month can no longer change.` });
}

export async function importFile(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("attendance.edit");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new FieldErrors({ file: "Choose a punch log file (.dat, .txt or .csv)." });
    const text = await file.text();
    const { punches, errors } = parseAttendanceText(text);
    if (!punches.length) return { ok: false, error: `No punches found.${errors.length ? ` ${errors.slice(0, 3).join("; ")}` : ""}` };
    const res = await importPunches(prisma, punches, { source: "FILE", createdBy: user.username, reason: `File ${file.name}` });
    let processed = "";
    if (fd.get("process") === "on" && res.from && res.to) {
      const company = await prisma.company.findFirstOrThrow();
      const today = todayLocal(company.tzOffsetMinutes);
      // A punch just after midnight may belong to the previous day's shift.
      const from = addDays(dateOnly(res.from), -1);
      const to = dateOnly(res.to) > today ? today : dateOnly(res.to);
      const locked = await prisma.payrollRun.findMany({ where: { status: "LOCKED", OR: monthsTouched(from, to).map(([year, month]) => ({ year, month })) } });
      if (locked.length) processed = " Attendance not re-processed because a payroll month in this range is locked.";
      else {
        const r = await processAttendance(prisma, { from, to });
        processed = ` Re-processed ${dmy(from)} – ${dmy(to)} (${r.days.toLocaleString("en-IN")} employee-days).`;
      }
    }
    await audit(user, "IMPORT", "PunchLog", "", `Imported ${file.name}: ${res.inserted} new, ${res.duplicates} duplicates`);
    refresh();
    const unknown = res.unknownIds.length ? ` Unknown punch IDs: ${res.unknownIds.slice(0, 15).join(", ")}${res.unknownIds.length > 15 ? "…" : ""}.` : "";
    const bad = errors.length ? ` ${errors.length} unreadable line(s), e.g. ${errors[0]}.` : "";
    return { ok: true, message: `Read ${punches.length.toLocaleString("en-IN")} punches: ${res.inserted.toLocaleString("en-IN")} new, ${res.duplicates.toLocaleString("en-IN")} already present.${unknown}${bad}${processed}` };
  });
}

async function employeeByCode(code: string) {
  const e = await prisma.employee.findUnique({ where: { empCode: code.trim() } });
  if (!e) throw new FieldErrors({ emp: "No employee with this ID" });
  return e;
}

export async function addManualPunch(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("attendance.edit");
    const emp = await employeeByCode(String(fd.get("emp") ?? ""));
    const date = parseDate(String(fd.get("date") ?? ""));
    const reason = String(fd.get("reason") ?? "").trim();
    const errors: Record<string, string> = {};
    if (!date) errors.date = "Required";
    if (reason.length < 5) errors.reason = "Explain why the punch is entered manually (kept for audit).";
    const times = ["inTime", "outTime"].map((k) => String(fd.get(k) ?? "").trim()).filter(Boolean);
    if (!times.length) errors.inTime = "Enter at least one time";
    const mins = times.map(parseHm);
    if (mins.some((m) => Number.isNaN(m))) errors.inTime = "Use HH:MM";
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    await ensureMonthOpen(date!);
    // An out-time earlier than the in-time belongs to the next calendar day (night shift).
    const stamps = mins.map((m, i) => addMinutes(date!, i === 1 && m < mins[0] ? m + 1440 : m));
    const res = await importPunches(prisma, stamps.map((time) => ({ punchId: emp.punchId, time })), { source: "MANUAL", createdBy: user.username, reason });
    const company = await prisma.company.findFirstOrThrow();
    const today = todayLocal(company.tzOffsetMinutes);
    await processAttendance(prisma, { from: addDays(date!, -1), to: addDays(date!, 1) > today ? date! : addDays(date!, 1), employeeIds: [emp.id] });
    await audit(user, "CREATE", "Attendance", emp.id, `Manual punch ${dmy(date!)} ${times.join(" / ")} — ${reason}`);
    refresh();
    return { ok: true, message: `Added ${res.inserted} manual punch(es) for ${emp.empCode} on ${dmy(date!)}.` };
  });
}

export async function saveAdjust(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("attendance.edit");
    const emp = await employeeByCode(String(fd.get("emp") ?? ""));
    const date = parseDate(String(fd.get("date") ?? ""));
    const status = String(fd.get("status") ?? "");
    const reason = String(fd.get("reason") ?? "").trim();
    const errors: Record<string, string> = {};
    if (!date) errors.date = "Required";
    if (!["PRESENT", "ABSENT"].includes(status)) errors.status = "Choose a status";
    if (reason.length < 5) errors.reason = "A reason is required (kept for audit).";
    const t = (k: string) => {
      const s = String(fd.get(k) ?? "").trim();
      if (!s) return null;
      const m = parseHm(s);
      if (Number.isNaN(m)) errors[k] = "Use HH:MM";
      return m;
    };
    const inM = t("adjIn"), outM = t("adjOut");
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    await ensureMonthOpen(date!);
    const inTime = inM === null ? null : addMinutes(date!, inM);
    const outTime = outM === null ? null : addMinutes(date!, inM !== null && outM < inM ? outM + 1440 : outM);
    await prisma.attendanceAdjust.upsert({
      where: { employeeId_date: { employeeId: emp.id, date: date! } },
      create: { employeeId: emp.id, date: date!, status, inTime, outTime, reason, createdBy: user.username },
      update: { status, inTime, outTime, reason, createdBy: user.username },
    });
    await processAttendance(prisma, { from: date!, to: date!, employeeIds: [emp.id] });
    await audit(user, "UPDATE", "Attendance", emp.id, `Attendance adjustment ${dmy(date!)} → ${status} — ${reason}`);
    refresh();
    return { ok: true, message: `Adjustment saved for ${emp.empCode} on ${dmy(date!)}.` };
  });
}

export async function deleteAdjust(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("attendance.edit");
    const id = Number(fd.get("id"));
    const a = await prisma.attendanceAdjust.findUniqueOrThrow({ where: { id } });
    await ensureMonthOpen(a.date);
    await prisma.attendanceAdjust.delete({ where: { id } });
    await processAttendance(prisma, { from: a.date, to: a.date, employeeIds: [a.employeeId] });
    await audit(user, "DELETE", "Attendance", a.employeeId, `Removed attendance adjustment ${dmy(a.date)} (${a.status})`);
    refresh();
    return { ok: true, message: "Adjustment removed." };
  });
}

export async function deleteManualPunch(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("attendance.edit");
    const id = Number(fd.get("id"));
    const p = await prisma.punchLog.findUniqueOrThrow({ where: { id } });
    if (p.source !== "MANUAL") return { ok: false, error: "Only manual punches can be removed; machine punches are permanent." };
    await ensureMonthOpen(dateOnly(p.time));
    await prisma.punchLog.delete({ where: { id } });
    if (p.employeeId) await processAttendance(prisma, { from: addDays(dateOnly(p.time), -1), to: dateOnly(p.time), employeeIds: [p.employeeId] });
    await audit(user, "DELETE", "Attendance", p.employeeId ?? "", `Removed manual punch ${dmy(p.time)} (${p.reason})`);
    refresh();
    return { ok: true, message: "Manual punch removed." };
  });
}

export async function deviceAction(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("device.manage");
    const deviceId = Number(fd.get("deviceId"));
    const op = String(fd.get("op") ?? "");
    const company = await prisma.company.findFirstOrThrow();
    try {
      switch (op) {
        case "info": {
          const i = await deviceInfo(prisma, deviceId);
          return { ok: true, message: `Connected. Users: ${i.userCounts}, logs: ${i.logCounts}, device clock ${dmy(i.time)} ${i.time.toISOString().slice(11, 16)}.` };
        }
        case "pull": {
          const r = await pullDeviceLogs(prisma, deviceId, user.username);
          let extra = "";
          if (r.from && r.to && r.inserted > 0) {
            const today = todayLocal(company.tzOffsetMinutes);
            const p = await processAttendance(prisma, { from: addDays(dateOnly(r.from), -1), to: dateOnly(r.to) > today ? today : dateOnly(r.to) });
            extra = ` Attendance re-processed (${p.days} employee-days).`;
          }
          await audit(user, "SYNC", "Device", deviceId, `Pulled logs: ${r.inserted} new`);
          refresh();
          return { ok: true, message: `${r.inserted} new punches, ${r.duplicates} already stored.${extra}` };
        }
        case "clock":
          await syncDeviceClock(prisma, deviceId, toLocal(new Date(), company.tzOffsetMinutes));
          await audit(user, "SYNC", "Device", deviceId, "Device clock synchronised");
          return { ok: true, message: "Device clock set to the server time." };
        case "enroll": {
          const due = await prisma.employee.findMany({ where: { status: "ACTIVE", devices: { none: { deviceId, removedAt: null } } }, select: { id: true } });
          const r = await pushEmployees(prisma, deviceId, due.map((d) => d.id));
          await audit(user, "SYNC", "Device", deviceId, `Enrolled ${r.added} employees`);
          refresh();
          return { ok: true, message: `Enrolled ${r.added} employees (${r.skipped} were already on the device).` };
        }
        case "remove": {
          const gone = await prisma.employee.findMany({ where: { status: "SEPARATED", devices: { some: { deviceId, removedAt: null } } }, select: { id: true } });
          const r = await removeEmployees(prisma, deviceId, gone.map((d) => d.id));
          await audit(user, "SYNC", "Device", deviceId, `Removed ${r.removed} separated employees`);
          refresh();
          return { ok: true, message: `Removed ${r.removed} separated employees (${r.notFound} were not on the device).` };
        }
        case "reconcile": {
          const r = await reconcileEnrollments(prisma, deviceId);
          refresh();
          return { ok: true, message: `Device user list read: ${r.enrolled} employees enrolled, ${r.missing} enrolment record(s) closed.` };
        }
        default:
          return { ok: false, error: "Unknown operation." };
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      await prisma.device.update({ where: { id: deviceId }, data: { lastSyncNote: `Error: ${msg}`.slice(0, 300) } }).catch(() => undefined);
      return { ok: false, error: msg };
    }
  });
}
