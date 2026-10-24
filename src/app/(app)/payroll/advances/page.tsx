import Link from "next/link";
import { ActionButton } from "@/components/form";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { dmy, monthKey, todayLocal, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { money, round2 } from "@/lib/num";
import { closeAdvance } from "../actions";
import { AdvanceForm } from "../forms";

export default async function AdvancesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("payroll.process");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const showAll = sp.all === "1";
  const advances = await prisma.advance.findMany({
    where: showAll ? {} : { status: "ACTIVE" },
    include: { employee: true, recoveries: true },
    orderBy: { date: "desc" },
  });
  return (
    <div className="space-y-5">
      <PageHeader title="Advances" subtitle="Salary advances are recovered in monthly instalments through payroll (s.125(c)); any balance is recovered in the final settlement." />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card
          title={`${advances.length} ${showAll ? "advances" : "active advances"}`}
          className="xl:col-span-2"
          bodyClass="overflow-x-auto p-0"
          actions={
            <Link href={showAll ? "/payroll/advances" : "/payroll/advances?all=1"} className="btn btn-ghost btn-sm">
              {showAll ? "Active only" : "Show all"}
            </Link>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Instalment</th>
                <th>From</th>
                <th className="text-right">Recovered</th>
                <th className="text-right">Outstanding</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {advances.map((a) => {
                const rec = round2(a.recoveries.reduce((s, r) => s + r.amount, 0));
                const out = round2(a.amount - rec);
                return (
                  <tr key={a.id}>
                    <td>
                      <Link className="link text-[13px] font-medium tabular-nums" href={`/employees/${a.employeeId}`}>
                        {a.employee.empCode}
                      </Link>
                      <div className="text-sm">{a.employee.nameEn}</div>
                      {a.reason && <div className="text-xs text-stone-500">{a.reason}</div>}
                    </td>
                    <td className="whitespace-nowrap">{dmy(a.date)}</td>
                    <td className="text-right tabular-nums">{money(a.amount)}</td>
                    <td className="text-right tabular-nums">
                      {money(a.amount / a.installments)} × {a.installments}
                    </td>
                    <td>{monthKey(a.startYear, a.startMonth)}</td>
                    <td className="text-right tabular-nums">{money(rec)}</td>
                    <td className="text-right font-medium tabular-nums">{money(out)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>{a.status === "ACTIVE" && <ActionButton action={closeAdvance} fields={{ id: a.id, cash: 1 }} label="Repaid in cash" confirm="Record the outstanding balance as repaid in cash and close this advance?" />}</td>
                  </tr>
                );
              })}
              {advances.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-500">
                    No advances.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card title="New advance" className="h-fit">
          <AdvanceForm today={ymd(today)} month={monthKey(today.getUTCFullYear(), today.getUTCMonth() + 1)} />
        </Card>
      </div>
    </div>
  );
}
