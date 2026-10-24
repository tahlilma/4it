const fs = require("fs");
const p = "src/app/(app)/payroll/increments/page.tsx";
let s = fs.readFileSync(p, "utf8");
const a = '            <ProposalTable rows={rows} canApprove={can(user, "increment.approve") && view === "PROPOSED"} canApply={can(user, "salary.edit") && view === "APPROVED"} />\n          </Card>';
if (!s.includes(a)) { console.error("MISSING"); process.exit(1); }
s = s.replace(a, '            <ProposalTable\n              rows={rows}\n              total={c[view] ?? 0}\n              view={view}\n              canApprove={can(user, "increment.approve") && view === "PROPOSED"}\n              canApply={can(user, "salary.edit") && view === "APPROVED"}\n            />\n            <Pager page={page} pages={Math.ceil((c[view] ?? 0) / PER_PAGE)} makeHref={(n) => `/payroll/increments?view=${view}&page=${n}`} />\n          </Card>');
fs.writeFileSync(p, s);
console.log("ok");
