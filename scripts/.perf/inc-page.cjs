const fs = require("fs");
function edit(p, pairs) {
  let s = fs.readFileSync(p, "utf8");
  for (const [a, b] of pairs) {
    if (!s.includes(a)) { console.error("MISSING in", p, ":", a.slice(0, 100)); process.exit(1); }
    s = s.replace(a, b);
  }
  fs.writeFileSync(p, s);
}
// Server action: "all in this view" selects every proposal with that status, not only the ticked page.
edit("src/app/(app)/payroll/actions.ts", [[
  '  const op = String(fd.get("op") ?? "");\n  if (!fd.getAll("id").length) return { ok: false, error: "Tick at least one proposal." };',
  '  const op = String(fd.get("op") ?? "");\n  const allView = String(fd.get("allView") ?? "");\n  if (allView === "PROPOSED" || allView === "APPROVED") {\n    const every = await prisma.increment.findMany({ where: { status: allView }, select: { id: true } });\n    fd.delete("id");\n    for (const r of every) fd.append("id", String(r.id));\n  }\n  if (!fd.getAll("id").length) return { ok: false, error: "Tick at least one proposal." };',
]]);
// Table: page of rows + optional "select all N in this view".
edit("src/app/(app)/payroll/forms.tsx", [
  ['export function ProposalTable({ rows, canApprove, canApply }: { rows: ProposalRow[]; canApprove: boolean; canApply: boolean }) {\n  const [sel, setSel] = useState<Set<number>>(new Set());',
   'export function ProposalTable({ rows, canApprove, canApply, total, view }: { rows: ProposalRow[]; canApprove: boolean; canApply: boolean; total: number; view: string }) {\n  const [sel, setSel] = useState<Set<number>>(new Set());\n  const [everything, setEverything] = useState(false);'],
  ['  const all = rows.length > 0 && sel.size === rows.length;',
   '  const all = rows.length > 0 && sel.size === rows.length;\n  const more = all && total > rows.length;'],
  ['      {[...sel].map((id) => (\n        <input key={id} type="hidden" name="id" value={id} />\n      ))}',
   '      {everything && more ? <input type="hidden" name="allView" value={view} /> : [...sel].map((id) => <input key={id} type="hidden" name="id" value={id} />)}'],
  ['        <span className="text-sm text-stone-500">{sel.size} selected</span>',
   '        <span className="text-sm text-stone-500">{everything && more ? `All ${total} in this view selected` : `${sel.size} selected`}</span>\n        {more && (\n          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEverything(!everything)}>\n            {everything ? "Only this page" : `Select all ${total} in this view`}\n          </button>\n        )}'],
  ['<input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} />',
   '<input type="checkbox" aria-label="Select all on this page" checked={all} onChange={() => { setEverything(false); setSel(all ? new Set() : new Set(rows.map((r) => r.id))); }} />'],
  ['<input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />',
   '<input type="checkbox" aria-label={`Select ${r.code}`} checked={sel.has(r.id)} onChange={() => { setEverything(false); toggle(r.id); }} />'],
]);
// Page: 100 proposals at a time.
edit("src/app/(app)/payroll/increments/page.tsx", [
  ['import { Card, PageHeader } from "@/components/ui";', 'import { Card, PageHeader, Pager } from "@/components/ui";'],
  ['const VIEWS = ["PROPOSED", "APPROVED", "APPLIED", "REJECTED"] as const;', 'const VIEWS = ["PROPOSED", "APPROVED", "APPLIED", "REJECTED"] as const;\n/** Proposals per page — the table is interactive, so it stays small even when thousands are due. */\nconst PER_PAGE = 100;'],
  ['  const view = (VIEWS as readonly string[]).includes(sp.view ?? "") ? sp.view! : "PROPOSED";', '  const view = (VIEWS as readonly string[]).includes(sp.view ?? "") ? sp.view! : "PROPOSED";\n  const page = Math.max(1, Number(sp.page) || 1);'],
  ['      orderBy: [{ effectiveDate: "asc" }, { employee: { empCode: "asc" } }],\n      take: 500,', '      orderBy: [{ effectiveDate: "asc" }, { employee: { empCode: "asc" } }],\n      skip: (page - 1) * PER_PAGE,\n      take: PER_PAGE,'],
]);
console.log("ok");
