import { Badge, Card, PageHeader, Pager } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { addDays, fromLocal, parseDate, stamp } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { qs, str, type SP } from "@/lib/employee-filter";

const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePerm("audit.view");
  const sp = await searchParams;
  const company = await getCompany();
  const from = parseDate(str(sp.from));
  const to = parseDate(str(sp.to));
  const where = {
    ...(str(sp.user) ? { userName: str(sp.user) } : {}),
    ...(str(sp.entity) ? { entity: str(sp.entity) } : {}),
    ...(str(sp.action) ? { action: str(sp.action) } : {}),
    ...(str(sp.q) ? { summary: { contains: str(sp.q) } } : {}),
    ...(from || to
      ? { at: { ...(from ? { gte: fromLocal(from, company.tzOffsetMinutes) } : {}), ...(to ? { lt: fromLocal(addDays(to, 1), company.tzOffsetMinutes) } : {}) } }
      : {}),
  };
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const [total, logs, users, entities, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.auditLog.findMany({ distinct: ["userName"], select: { userName: true } }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true } }),
  ]);
  const sel = (name: string, label: string, opts: string[]) => (
    <div>
      <label className="label">{label}</label>
      <select name={name} defaultValue={str(sp[name])} className="input">
        <option value="">All</option>
        {opts.filter(Boolean).sort().map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" subtitle="Append-only record of sign-ins, changes, processing, locking and exports — who did what and when." />
      <form method="get" className="card grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-7">
        {sel("user", "User", users.map((u) => u.userName))}
        {sel("entity", "Record type", entities.map((e) => e.entity))}
        {sel("action", "Action", actions.map((a) => a.action))}
        <div>
          <label className="label">From</label>
          <input type="date" name="from" defaultValue={str(sp.from)} className="input" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" name="to" defaultValue={str(sp.to)} className="input" />
        </div>
        <div>
          <label className="label">Text</label>
          <input name="q" defaultValue={str(sp.q)} className="input" />
        </div>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary">Filter</button>
          <a href="/audit" className="btn btn-ghost">
            Reset
          </a>
        </div>
      </form>
      <Card bodyClass="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Record</th>
              <th>Summary / changes</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs">{stamp(l.at, company.tzOffsetMinutes)}</td>
                <td className="text-sm">{l.userName}</td>
                <td>
                  <Badge tone={l.action.includes("FAIL") || l.action === "DELETE" || l.action === "UNLOCK" ? "red" : l.action === "LOCK" ? "violet" : "slate"}>{l.action}</Badge>
                </td>
                <td className="text-xs">
                  {l.entity}
                  {l.entityId && <span className="text-stone-400"> #{l.entityId}</span>}
                </td>
                <td className="max-w-xl text-xs">
                  {l.summary}
                  {l.changes && <details className="mt-0.5"><summary className="cursor-pointer text-stone-400">changes</summary><pre className="mt-1 whitespace-pre-wrap break-all rounded bg-stone-50 p-1.5 text-[10px]">{prettyChanges(l.changes)}</pre></details>}
                </td>
                <td className="text-xs text-stone-400">{l.ip}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-stone-500">
                  No entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager page={page} pages={Math.ceil(total / PAGE)} makeHref={(p) => `/audit${qs(sp, { page: p })}`} />
      </Card>
    </div>
  );
}

function prettyChanges(json: string): string {
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(v)
      .map(([k, x]) => (Array.isArray(x) && x.length === 2 ? `${k}: ${JSON.stringify(x[0])} → ${JSON.stringify(x[1])}` : `${k}: ${JSON.stringify(x)}`))
      .join("\n");
  } catch {
    return json;
  }
}
