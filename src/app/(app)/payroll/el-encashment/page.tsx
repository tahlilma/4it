import Link from "next/link";
import { ActionButton } from "@/components/form";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { dmy, todayLocal, utcDate, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { int, money } from "@/lib/num";
import { postElRun, regenerateElRun } from "../actions";
import { ElRunForm } from "../forms";

export default async function ElEncashPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePerm("payroll.process");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const runs = await prisma.elEncashRun.findMany({ orderBy: { asOfDate: "desc" }, include: { _count: { select: { lines: true } } } });
  const sums = await prisma.elEncashLine.groupBy({ by: ["runId"], _sum: { encashDays: true, net: true } });
  const byRun = new Map(sums.map((s) => [s.runId, s]));
  const selected = sp.run ? runs.find((r) => r.id === Number(sp.run)) : null;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Earned-leave encashment"
        subtitle={`Rule 107(2): an employee may encash up to ${company.elEncashMaxPercent}% of the unspent earned leave, once a year. Rate = ${company.elRateBasis.toLowerCase()} ÷ 30 per day. Posting deducts the encashed days from balances.`}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Encashment sheets" className="xl:col-span-2" bodyClass="overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Title</th>
                <th>As of</th>
                <th className="text-right">Employees</th>
                <th className="text-right">Days</th>
                <th className="text-right">Net amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className={selected?.id === r.id ? "bg-hue-blue/[0.08]" : ""}>
                  <td className="font-medium">{r.title}</td>
                  <td>{dmy(r.asOfDate)}</td>
                  <td className="text-right tabular-nums">{int(r._count.lines)}</td>
                  <td className="text-right tabular-nums">{byRun.get(r.id)?._sum.encashDays?.toFixed(2) ?? 0}</td>
                  <td className="text-right tabular-nums">{money(byRun.get(r.id)?._sum.net ?? 0, false)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link className="btn btn-secondary btn-sm" href={`/reports/el-encashment?elrun=${r.id}&run=1`}>
                        Sheet
                      </Link>
                      {r.status === "DRAFT" && <ActionButton action={regenerateElRun} fields={{ id: r.id }} label="Recalculate" />}
                      {r.status === "DRAFT" && can(user, "payroll.lock") && <ActionButton action={postElRun} fields={{ id: r.id }} label="Post" variant="success" confirm="Post this encashment? Encashed days will be deducted from balances." />}
                    </div>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    No encashment sheets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card title="New encashment" className="h-fit">
          <ElRunForm date={ymd(utcDate(today.getUTCFullYear(), 12, 31) > today ? today : utcDate(today.getUTCFullYear(), 12, 31))} year={today.getUTCFullYear()} />
        </Card>
      </div>
    </div>
  );
}
