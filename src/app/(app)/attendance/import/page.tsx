import { Card, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { stamp } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { int } from "@/lib/num";
import { ImportForm } from "../forms";

export default async function ImportPage() {
  await requirePerm("attendance.edit");
  const company = await getCompany();
  const recent = await prisma.auditLog.findMany({ where: { entity: "PunchLog", action: "IMPORT" }, orderBy: { at: "desc" }, take: 10 });
  const bySource = await prisma.punchLog.groupBy({ by: ["source"], _count: { _all: true } });
  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Import punch log" subtitle="Upload a log exported from the punch machine (USB / software export) when network sync isn't available." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Upload">
          <ImportForm />
        </Card>
        <Card title="Accepted formats">
          <div className="space-y-2 text-sm text-stone-600">
            <p>One punch per line, punch ID first:</p>
            <pre className="overflow-x-auto rounded bg-stone-50 p-2 text-xs">{`   10001\t2026-10-21 07:55:12\t1\t0\t1\t0   (ZKTeco attlog)
10001,2026-10-21 07:55:12
10001,21/10/2026,07:55
10001;21-Oct-2026;7:55 AM`}</pre>
            <p>Duplicates are skipped automatically, so the same file can be imported twice safely.</p>
            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              {bySource.map((s) => (
                <span key={s.source} className="rounded bg-stone-100 px-2 py-1">
                  {s.source}: {int(s._count._all)}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
      <Card title="Recent imports" bodyClass="p-0">
        <table className="tbl">
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{stamp(r.at, company.tzOffsetMinutes)}</td>
                <td>{r.userName}</td>
                <td className="text-sm">{r.summary}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td className="py-6 text-center text-stone-500">No file imports yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
