const fs = require("fs");
function edit(p, pairs, importLine, after) {
  let s = fs.readFileSync(p, "utf8");
  for (const [a, b] of pairs) {
    if (!s.includes(a)) { console.error("MISSING in", p, ":", a.slice(0, 90)); process.exit(1); }
    s = s.split(a).join(b);
  }
  if (importLine && !s.includes(importLine)) {
    if (!s.includes(after)) { console.error("NO ANCHOR", p, after); process.exit(1); }
    s = s.replace(after, after + "\n" + importLine);
  }
  fs.writeFileSync(p, s);
}
const imp = 'import { inChunks } from "../../chunk";';
edit("src/lib/reports/defs/attendance.tsx", [[
  "  const hist = await prisma.attendanceDay.findMany({\n    where: { employeeId: { in: empIds }, date: { gte: addDays(date, -90), lte: date } },\n    select: { employeeId: true, date: true, status: true },\n    orderBy: [{ employeeId: \"asc\" }, { date: \"desc\" }],\n  });",
  "  const hist = await inChunks(empIds, (slice) =>\n    prisma.attendanceDay.findMany({\n      where: { employeeId: { in: slice }, date: { gte: addDays(date, -90), lte: date } },\n      select: { employeeId: true, date: true, status: true },\n      orderBy: [{ employeeId: \"asc\" }, { date: \"desc\" }],\n    }),\n  );",
]], imp, 'import { prisma } from "../../db";');
edit("src/lib/reports/defs/documents.tsx", [
  ["const noms = await prisma.nominee.findMany({ where: { employeeId: { in: emps.map((e) => e.id) } }, orderBy: { id: \"asc\" } });",
   "const noms = await inChunks(emps.map((e) => e.id), (slice) => prisma.nominee.findMany({ where: { employeeId: { in: slice } }, orderBy: { id: \"asc\" } }));"],
  ["const hist = await prisma.salaryHistory.findMany({ where: { employeeId: { in: emps.map((e) => e.id) } }, include: { designation: true, grade: true }, orderBy: { effectiveDate: \"asc\" } });",
   "const hist = await inChunks(emps.map((e) => e.id), (slice) => prisma.salaryHistory.findMany({ where: { employeeId: { in: slice } }, include: { designation: true, grade: true }, orderBy: { effectiveDate: \"asc\" } }));"],
  ["        prisma.salaryHistory.findMany({ where: { employeeId: { in: ids } }, include: { designation: true }, orderBy: { effectiveDate: \"asc\" } }),",
   "        inChunks(ids, (slice) => prisma.salaryHistory.findMany({ where: { employeeId: { in: slice } }, include: { designation: true }, orderBy: { effectiveDate: \"asc\" } })),"],
  ["        prisma.leaveApplication.findMany({ where: { employeeId: { in: ids }, status: \"APPROVED\", leaveType: { code: \"EL\" } }, orderBy: { fromDate: \"asc\" } }),",
   "        inChunks(ids, (slice) => prisma.leaveApplication.findMany({ where: { employeeId: { in: slice }, status: \"APPROVED\", leaveType: { code: \"EL\" } }, orderBy: { fromDate: \"asc\" } })),"],
], imp, 'import { prisma } from "../../db";');
edit("src/lib/reports/defs/employee.tsx", [[
  "const hist = await prisma.salaryHistory.findMany({ where: { employeeId: { in: emps.map((e) => e.id) } }, include: { designation: true, grade: true }, orderBy: [{ employeeId: \"asc\" }, { effectiveDate: \"asc\" }] });",
  "const hist = await inChunks(emps.map((e) => e.id), (slice) =>\n        prisma.salaryHistory.findMany({ where: { employeeId: { in: slice } }, include: { designation: true, grade: true }, orderBy: [{ employeeId: \"asc\" }, { effectiveDate: \"asc\" }] }),\n      );",
]], imp, 'import { prisma } from "../../db";');
edit("src/lib/reports/defs/leave.tsx", [[
  "        prisma.leaveApplication.findMany({ where: { employeeId: { in: ids }, fromDate: { lte: yEnd }, toDate: { gte: yStart } }, include: { leaveType: true }, orderBy: { fromDate: \"asc\" } }),",
  "        inChunks(ids, (slice) => prisma.leaveApplication.findMany({ where: { employeeId: { in: slice }, fromDate: { lte: yEnd }, toDate: { gte: yStart } }, include: { leaveType: true }, orderBy: { fromDate: \"asc\" } })),",
]], imp, 'import { prisma } from "../../db";');
edit("src/lib/services/lefty.ts", [[
  "  const rows = await db.attendanceDay.findMany({\n    where: { employeeId: { in: ids }, date: { gte: addDays(maxDate, -120), lte: maxDate } },\n    select: { employeeId: true, date: true, status: true },\n    orderBy: [{ employeeId: \"asc\" }, { date: \"desc\" }],\n  });",
  "  const rows = await inChunks(ids, (slice) =>\n    db.attendanceDay.findMany({\n      where: { employeeId: { in: slice }, date: { gte: addDays(maxDate, -120), lte: maxDate } },\n      select: { employeeId: true, date: true, status: true },\n      orderBy: [{ employeeId: \"asc\" }, { date: \"desc\" }],\n    }),\n  );",
]], 'import { inChunks } from "../chunk";', 'import type { PrismaClient } from "@/generated/prisma/client";');
console.log("ok");
