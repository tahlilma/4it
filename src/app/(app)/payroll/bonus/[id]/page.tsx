import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/form";
import { Alert, Card, KV, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { FESTIVALS, label } from "@/lib/constants";
import { dmy } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { parseSlabs } from "@/lib/engine/bonus";
import { int, money } from "@/lib/num";
import { lockBonusRun, processBonusRun } from "../../actions";

export default async function BonusRunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("bonus.manage");
  const { id } = await params;
  const run = await prisma.bonusRun.findUnique({ where: { id: Number(id) } });
  if (!run) notFound();
  const [agg, byDept, depts] = await Promise.all([
    prisma.bonusLine.aggregate({ where: { runId: run.id }, _count: { _all: true }, _sum: { amount: true, stamp: true, net: true } }),
    prisma.bonusLine.groupBy({ by: ["departmentId"], where: { runId: run.id }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const slabs = parseSlabs(run.slabs);
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/payroll/bonus", label: "Festival bonus" }}
        title={
          <span className="flex items-center gap-3">
            {run.title} <StatusBadge status={run.status} />
          </span>
        }
        actions={
          <>
            {run.status !== "LOCKED" && <ActionButton action={processBonusRun} fields={{ id: run.id }} label={run.status === "DRAFT" ? "Process" : "Re-process"} variant="primary" />}
            {run.status === "PROCESSED" && can(user, "payroll.lock") && <ActionButton action={lockBonusRun} fields={{ id: run.id }} label="Lock" variant="success" confirm="Lock this bonus sheet?" />}
          </>
        }
      />
      <Card>
        <KV
          cols={4}
          items={[
            ["Festival", label(FESTIVALS, run.festival)],
            ["Service counted up to", dmy(run.cutoffDate)],
            ["Payment date", dmy(run.paymentDate)],
            ["Basis", run.basis === "BASIC" ? "Basic wage" : "Gross wage"],
            ["Religions", run.religions === "ALL" ? "All employees" : run.religions],
            ["Slabs", slabs.map((s) => `${s.percent}% at ≥ ${s.minMonths} months`).join(" · ")],
            ["Revenue stamp", money(run.stamp)],
          ]}
        />
        {run.basis === "GROSS" && <div className="mt-3"><Alert tone="amber">r.111(5) caps each festival bonus at one month&apos;s basic wage; a gross-based bonus pays more than the statutory minimum — fine, but record it as company policy.</Alert></div>}
      </Card>
      {agg._count._all > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Eligible employees" value={int(agg._count._all)} tone="blue" />
            <Stat label="Bonus total" value={money(agg._sum.amount ?? 0, false)} tone="green" />
            <Stat label="Net after stamp" value={money(agg._sum.net ?? 0, false)} />
          </div>
          <Card title="By department" bodyClass="p-0">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="text-right">Employees</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {depts
                  .map((d) => ({ d, x: byDept.find((b) => b.departmentId === d.id) }))
                  .filter((r) => r.x)
                  .map(({ d, x }) => (
                    <tr key={d.id}>
                      <td>{d.nameEn}</td>
                      <td className="text-right tabular-nums">{x!._count._all}</td>
                      <td className="text-right tabular-nums">{money(x!._sum.amount ?? 0, false)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
          <div className="flex gap-2">
            <Link className="btn btn-secondary" href={`/reports/bonus-sheet?bonus=${run.id}&run=1`}>
              Bonus sheet
            </Link>
            <Link className="btn btn-secondary" href={`/reports/bonus-summary?bonus=${run.id}&run=1`}>
              Bonus summary
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
