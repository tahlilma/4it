const fs = require("fs");
const p = "src/lib/reports/defs/documents.tsx";
let s = fs.readFileSync(p, "utf8");
const must = (a) => { if (!s.includes(a)) { console.error("MISSING:", a.slice(0, 100)); process.exit(1); } };
// 1. helper
const oldHelper = 'function pages<T>(list: T[], render: (t: T, last: boolean) => ReactNode, empty = "No employees match the filter."): { node?: ReactNode; empty?: string } {\n  if (!list.length) return { empty };\n  return { node: list.map((t, i) => render(t, i === list.length - 1)) };\n}';
must(oldHelper);
s = s.replace(oldHelper, '/** One document per item, limited to the current batch (see ReportDef.batch). */\nfunction pages<T>(f: Filters, list: T[], render: (t: T, last: boolean) => ReactNode, empty = "No employees match the filter."): { node?: ReactNode; empty?: string } {\n  if (!list.length) return { empty };\n  const items = takeBatch(f, list);\n  return { node: items.map((t, i) => render(t, i === items.length - 1)) };\n}');
// 2. call sites
const before = (s.match(/\.\.\.pages\(/g) || []).length;
s = s.replace(/\.\.\.pages\(/g, "...pages(f, ");
console.log("call sites:", before);
// 3. imports
must('import type { ReportDef } from "../types";');
s = s.replace('import type { ReportDef } from "../types";', 'import type { Filters, ReportDef } from "../types";');
must('import { groupBy, loadEmployees, type EmpRow, secTitle } from "../util";');
s = s.replace('import { groupBy, loadEmployees, type EmpRow, secTitle } from "../util";', 'import { groupBy, loadEmployees, type EmpRow, secTitle, takeBatch } from "../util";');
// 4. ID cards: batch employees before grouping them four to a sheet
const idOld = '      const emps = await loadEmployees(f);\n      const bnF = f.format !== "en";\n      const perPage = 4;';
must(idOld);
s = s.replace(idOld, '      const emps = takeBatch(f, await loadEmployees(f));\n      const bnF = f.format !== "en";\n      const perPage = 4;');
// 5. batch sizes
const sizes = { "job-application": 100, "appointment-letter": 100, "fitness-certificate": 100, "nominee-form": 100, "id-card": 200, "confirmation-letter": 100, "increment-letter": 100, "leave-application": 100, "service-book": 50, "final-settlement": 100, "lefty-letter": 100, "lefty-envelope": 200, "show-cause": 100, "maternity-benefit": 100 };
for (const [slug, n] of Object.entries(sizes)) {
  const i = s.indexOf(`slug: "${slug}",`);
  if (i < 0) { console.error("no slug", slug); process.exit(1); }
  const j = s.indexOf("\n", s.indexOf("perm: ", i));
  s = s.slice(0, j + 1) + `    batch: ${n},\n` + s.slice(j + 1);
}
fs.writeFileSync(p, s);
console.log("ok");
