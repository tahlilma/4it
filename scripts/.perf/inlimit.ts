// Temporary probe: which Prisma operations survive very long IN (...) lists on SQLite.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../src/generated/prisma/client";
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:./data/perf.db" }) });
async function main() {
const ids = (await db.employee.findMany({ select: { id: true } })).map((e) => e.id);
const big = [...ids, ...ids, ...ids, ...ids, ...ids, ...ids, ...ids].slice(0, 40000);
for (const n of [500, 999, 5000]) {
  const list = big.slice(0, n);
  const r: Record<string, string> = {};
  for (const [name, fn] of [
    ["findMany", () => db.employee.findMany({ where: { id: { in: list } }, select: { id: true } })],
    ["count", () => db.employee.count({ where: { id: { in: list } } })],
    ["groupBy", () => db.salaryHistory.groupBy({ by: ["employeeId"], where: { employeeId: { in: list } }, _max: { effectiveDate: true } })],
    ["aggregate", () => db.attendanceDay.aggregate({ where: { employeeId: { in: list } }, _count: { _all: true } })],
    ["updateMany", () => db.employee.updateMany({ where: { id: { in: list }, nameEn: "__never__" }, data: { remarks: "" } })],
    ["deleteMany", () => db.attendanceDay.deleteMany({ where: { employeeId: { in: list }, date: { lt: new Date(0) } } })],
    ["findManyOrdered", () => db.salaryHistory.findMany({ where: { employeeId: { in: list } }, orderBy: { effectiveDate: "asc" }, select: { effectiveDate: true } }).then((r) => { for (let i = 1; i < r.length; i++) if (r[i].effectiveDate < r[i - 1].effectiveDate) throw Object.assign(new Error("order"), { code: "UNORDERED" }); })],
  ] as const) {
    try { await (fn as () => Promise<unknown>)(); r[name] = "ok"; } catch (e) { r[name] = (e as { code?: string }).code ?? "err"; }
  }
  console.log(n, JSON.stringify(r));
}
await db.$disconnect();
}
main();
