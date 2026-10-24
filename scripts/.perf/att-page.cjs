const fs = require("fs");
const p = "src/app/(app)/attendance/page.tsx";
let s = fs.readFileSync(p, "utf8");
const rep = [
  ['import { Badge, Card, LinkButton, PageHeader, Stat } from "@/components/ui";', 'import { Badge, Card, LinkButton, PageHeader, Pager, Stat } from "@/components/ui";'],
  ['export default async function AttendancePage(', '/** Rows per page: a whole factory day (thousands of rows) would be too heavy for modest PCs and phones. */\nconst PAGE = 100;\n\nexport default async function AttendancePage('],
  ['  const empWhere = employeeWhere(parseEmpFilter(sp), { defaultStatus: "ALL" });\n\n  const rows = await prisma.attendanceDay.findMany({\n    where: { date, employee: empWhere, ...(status ? (status === "PRESENT" ? { status: { in: ["PRESENT", "LATE"] } } : { status }) : {}) },\n    include: { employee: { include: { designation: true, section: true, line: true } } },\n    orderBy: EMP_ORDER.map((o) => ({ employee: o })),\n  });',
   '  const empWhere = employeeWhere(parseEmpFilter(sp), { defaultStatus: "ALL" });\n  const page = Math.max(1, Number(str(sp.page)) || 1);\n  const where = { date, employee: empWhere, ...(status ? (status === "PRESENT" ? { status: { in: ["PRESENT", "LATE"] } } : { status }) : {}) };\n\n  const [shown, rows] = await Promise.all([\n    prisma.attendanceDay.count({ where }),\n    prisma.attendanceDay.findMany({\n      where,\n      include: { employee: { include: { designation: true, section: true, line: true } } },\n      orderBy: EMP_ORDER.map((o) => ({ employee: o })),\n      skip: (page - 1) * PAGE,\n      take: PAGE,\n    }),\n  ]);'],
  ['  const nav = (d: Date) => `/attendance${qs(sp, { date: ymd(d) })}`;', '  const nav = (d: Date) => `/attendance${qs(sp, { date: ymd(d), page: null })}`;'],
  ['href={`/attendance${qs(sp, { st: "PRESENT" })}`}', 'href={`/attendance${qs(sp, { st: "PRESENT", page: null })}`}'],
  ['href={`/attendance${qs(sp, { st: "LATE" })}`}', 'href={`/attendance${qs(sp, { st: "LATE", page: null })}`}'],
  ['href={`/attendance${qs(sp, { st: "ABSENT" })}`}', 'href={`/attendance${qs(sp, { st: "ABSENT", page: null })}`}'],
  ['href={`/attendance${qs(sp, { st: "LEAVE" })}`}', 'href={`/attendance${qs(sp, { st: "LEAVE", page: null })}`}'],
  ['href={`/attendance${qs(sp, { st: "OFF" })}`}', 'href={`/attendance${qs(sp, { st: "OFF", page: null })}`}'],
];
for (const [a, b] of rep) {
  if (!s.includes(a)) { console.error("MISSING:", a.slice(0, 100)); process.exit(1); }
  s = s.replace(a, b);
}
fs.writeFileSync(p, s);
console.log("ok");
