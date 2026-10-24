import Link from "next/link";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { addMonths, dmy, monthKey, monthLabel, startOfMonth, stamp, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { int, money } from "@/lib/num";
import { CreateRunForm } from "./forms";

export default async function PayrollIndex() {
  const user = await requirePerm("payroll.view");
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const last = addMonths(startOfMonth(today.getUTCFullYear(), today.getUTCMonth() + 1), -1);
  const runs = await prisma.payrollRun.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] });
  const sums = await prisma.payslip.groupBy({ by: ["runId"], _count: { _all: true }, _sum: { grossPayable: true, otAmount: true, netPayable: true } });
  const byRun = new Map(sums.map((s) => [s.runId, s]));
  return (
    <div className="space-y-5">
      <PageHeader title="Salary processing" subtitle="Process wages from attendance after each month ends, review, then lock once paid. Locked months can't change." />
      {can(user, "payroll.process") && (
        <Card title="Open a payroll month">
          <CreateRunForm month={monthKey(last.getUTCFullYear(), last.getUTCMonth() + 1)} />
        </Card>
      )}
      <Card title="Payroll months" bodyClass="overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Month</th>
              <th>Status</th>
              <th className="text-right">Employees</th>
              <th className="text-right">Gross payable</th>
              <th className="text-right">Overtime</th>
              <th className="text-right">Net pay</th>
              <th>Processed</th>
              <th>Paid / locked</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const s = byRun.get(r.id);
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/payroll/${r.id}`} className="link font-medium">
                      {monthLabel(r.year, r.month)}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="text-right tabular-nums">{int(s?._count._all ?? 0)}</td>
                  <td className="text-right tabular-nums">{money(s?._sum.grossPayable ?? 0, false)}</td>
                  <td className="text-right tabular-nums">{money(s?._sum.otAmount ?? 0, false)}</td>
                  <td className="text-right font-medium tabular-nums">{money(s?._sum.netPayable ?? 0, false)}</td>
                  <td className="text-xs text-stone-500">
                    {stamp(r.processedAt, company.tzOffsetMinutes)}
                    <div>{r.processedBy}</div>
                  </td>
                  <td className="text-xs text-stone-500">
                    {r.paymentDate && <div>Paid {dmy(r.paymentDate)}</div>}
                    {r.lockedBy && <div>by {r.lockedBy}</div>}
                  </td>
                </tr>
              );
            })}
            {runs.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-stone-500">
                  No payroll yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
