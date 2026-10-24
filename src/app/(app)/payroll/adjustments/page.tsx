import Link from "next/link";
import { ActionButton } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { ADJUST_KINDS, label } from "@/lib/constants";
import { addMonths, monthKey, monthLabel, parseMonth, startOfMonth, stamp, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { money } from "@/lib/num";
import { deleteAdjustment } from "../actions";
import { AdjustmentForm } from "../forms";

export default async function AdjustmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("payroll.process");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const last = addMonths(startOfMonth(today.getUTCFullYear(), today.getUTCMonth() + 1), -1);
  const m = parseMonth(sp.month) ?? { year: last.getUTCFullYear(), month: last.getUTCMonth() + 1 };
  const rows = await prisma.payAdjustment.findMany({ where: { year: m.year, month: m.month }, include: { employee: true }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-5">
      <PageHeader title="Additions & deductions" subtitle="Arrears, other additions and lawful deductions (s.125) applied when the month's payroll is processed." />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card
          title={`${monthLabel(m.year, m.month)} — ${rows.length} entries`}
          className="xl:col-span-2"
          bodyClass="overflow-x-auto p-0"
          actions={
            <form method="get" className="flex gap-2">
              <input type="month" name="month" defaultValue={monthKey(m.year, m.month)} className="input py-1" />
              <button className="btn btn-secondary btn-sm">Show</button>
            </form>
          }
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
                <th>Reason</th>
                <th>Entered</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link className="link text-[13px] font-medium tabular-nums" href={`/employees/${r.employeeId}`}>
                      {r.employee.empCode}
                    </Link>
                    <div className="text-sm">{r.employee.nameEn}</div>
                  </td>
                  <td>{label(ADJUST_KINDS, r.kind)}</td>
                  <td className={`text-right tabular-nums ${r.kind === "DEDUCTION" ? "text-ink-red" : ""}`}>{money(r.amount)}</td>
                  <td className="text-xs">{r.reason}</td>
                  <td className="text-xs text-stone-500">
                    {r.createdBy}
                    <div>{stamp(r.createdAt, company.tzOffsetMinutes)}</div>
                  </td>
                  <td>
                    <ActionButton action={deleteAdjustment} fields={{ id: r.id }} label="Remove" confirm="Remove this entry?" />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    No additions or deductions for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card title="Add entry" className="h-fit">
          <AdjustmentForm month={monthKey(m.year, m.month)} />
        </Card>
      </div>
    </div>
  );
}
