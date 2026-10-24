import { PrismaClient } from "../../src/generated/prisma/client";
import { sqliteAdapter } from "../../src/lib/sqlite";
async function main() {
  const db = new PrismaClient({ adapter: sqliteAdapter() });
  const t = async <T,>(label: string, fn: () => Promise<T>) => { const t0 = performance.now(); const r = await fn(); console.log(label.padEnd(44), Math.round(performance.now() - t0), "ms"); return r; };
  await db.company.findFirst(); // warm connection
  const active = await t("active employees + grade/desig/nominees/devices", () => db.employee.findMany({ where: { status: "ACTIVE" }, include: { grade: true, designation: true, nominees: { select: { id: true } }, devices: { where: { removedAt: null }, select: { id: true } } } }));
  await t("active employees, needed columns only", () => db.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true, empCode: true, nameEn: true, dob: true, nidNo: true, birthRegNo: true } }));
  const days = await t("month of attendance rows (select)", () => db.attendanceDay.findMany({ where: { date: { gte: new Date("2026-09-01T00:00:00Z"), lte: new Date("2026-09-30T00:00:00Z") } }, select: { employeeId: true, date: true, dayType: true, status: true, workMin: true, otMin: true, otHours: true, inTime: true, outTime: true }, orderBy: [{ employeeId: "asc" }, { date: "asc" }] }));
  await t("group rows by spreading arrays", async () => { const m = new Map<number, typeof days>(); for (const d of days) m.set(d.employeeId, [...(m.get(d.employeeId) ?? []), d]); return m; });
  await t("group rows by push", async () => { const m = new Map<number, typeof days>(); for (const d of days) { const l = m.get(d.employeeId); if (l) l.push(d); else m.set(d.employeeId, [d]); } return m; });
  console.log("rows:", days.length, "active:", active.length);
  await db.$disconnect();
}
main();
