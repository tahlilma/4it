// Pull punches from every active punch machine and re-process attendance for the affected dates.
// Schedule with Windows Task Scheduler, e.g. every 30 minutes:  npm run device:sync
// Locked payroll months are never re-processed (enforced by the attendance service).

import "dotenv/config";
import { sqliteAdapter } from "../src/lib/sqlite";
import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, dateOnly, dmy, todayLocal } from "../src/lib/dates";
import { processAttendance } from "../src/lib/services/attendance";
import { pullDeviceLogs } from "../src/lib/services/device";

const db = new PrismaClient({ adapter: sqliteAdapter() });

async function main() {
  const company = await db.company.findFirstOrThrow();
  const today = todayLocal(company.tzOffsetMinutes);
  const devices = await db.device.findMany({ where: { active: true } });
  let from: Date | null = null;
  let to: Date | null = null;
  const notes: string[] = [];
  for (const d of devices) {
    try {
      const r = await pullDeviceLogs(db, d.id, "scheduler");
      notes.push(`${d.name}: ${r.inserted} new`);
      console.log(`${d.name} (${d.ip}): ${r.inserted} new punches, ${r.duplicates} already stored`);
      if (r.inserted > 0 && r.from && r.to) {
        if (!from || r.from < from) from = r.from;
        if (!to || r.to > to) to = r.to;
      }
    } catch (e) {
      notes.push(`${d.name}: failed`);
      console.error(`${d.name} (${d.ip}): ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
  if (from && to) {
    const start = addDays(dateOnly(from), -1);
    const end = dateOnly(to) > today ? today : dateOnly(to);
    const r = await processAttendance(db, { from: start, to: end });
    console.log(`Re-processed ${dmy(start)} – ${dmy(end)}: ${r.days} employee-days`);
  }
  await db.auditLog.create({ data: { action: "SYNC", entity: "Device", userName: "scheduler", summary: notes.join("; ").slice(0, 500) || "No active devices" } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
