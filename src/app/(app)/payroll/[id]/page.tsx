import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/form";
import { Alert, Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { label, PAYMENT_MODES, PAYSLIP_CATEGORIES } from "@/lib/constants";
import { dmy, endOfMonth, monthKey, monthLabel, stamp, todayLocal, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { workingDaysAfter } from "@/lib/deadlines";
import { hours, int, money } from "@/lib/num";
import { processRun } from "../actions";
import { LockForm, UnlockForm } from "../forms";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("payroll.view");
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({ where: { id: Number(id) } });
  if (!run) notFound();
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const mEnd = endOfMonth(run.year, run.month);
  const due = await workingDaysAfter(mEnd, company.wageDueWorkingDays);
  const where = { runId: run.id };
  const [tot, byMode, byCat, byDept, depts] = await Promise.all([
    prisma.payslip.aggregate({
      where,
      _count: { _all: true },
      _sum: { earnedGross: true, absentDeduction: true, otHours: true, otHoursExcess: true, otAmount: true, attendanceBonus: true, holidayAllowance: true, arrear: true, otherAddition: true, grossPayable: true, advanceDeduction: true, stamp: true, tax: true, otherDeduction: true, netPayable: true },
    }),
    prisma.payslip.groupBy({ by: ["paymentMode"], where, _count: { _all: true }, _sum: { netPayable: true } }),
    prisma.payslip.groupBy({ by: ["category"], where, _count: { _all: true } }),
    prisma.payslip.groupBy({ by: ["departmentId"], where, _count: { _all: true }, _sum: { grossPayable: true, otHours: true, otAmount: true, netPayable: true, absentDeduction: true } }),
    prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const s = tot._sum;
  const month = monthKey(run.year, run.month);
  const late = run.status !== "LOCKED" && today > due;
  const reports: [string, string][] = [
    ["salary-sheet", "Salary sheet"],
    ["pay-slip", "Pay slips"],
    ["salary-summary", "Salary summary"],
    ["bank-sheet", "Bank / MFS sheet"],
    ["only-ot", "Overtime sheet"],
    ["salary-two-hour-ot", "Statutory-OT split sheet"],
    ["extra-ot", "OT beyond limit"],
    ["holiday-sheet", "Holiday sheet"],
    ["salary-summary-status", "Summary by status"],
    ["salary-summary-type", "Summary by type"],
    ["compare-salary", "Compare with previous month"],
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/payroll", label: "Salary processing" }}
        title={
          <span className="flex items-center gap-3">
            Payroll — {monthLabel(run.year, run.month)} <StatusBadge status={run.status} />
          </span>
        }
        subtitle={`Processed ${stamp(run.processedAt, company.tzOffsetMinutes) || "—"} ${run.processedBy ? `by ${run.processedBy}` : ""} · Payment due by ${dmy(due)} (s.123)`}
        actions={
          run.status !== "LOCKED" && can(user, "payroll.process") ? (
            <ActionButton action={processRun} fields={{ id: run.id }} label={run.status === "DRAFT" ? "Process payroll" : "Re-process"} variant="primary" size={undefined} confirm={run.status === "PROCESSED" ? "Re-process? Attendance for the month is recalculated and payslips are rebuilt." : undefined} />
          ) : undefined
        }
      />
      {late && <Alert tone="red" title="Payment deadline passed">Wages for {monthLabel(run.year, run.month)} were due by {dmy(due)} (7 working days after the wage period, s.123). Lock the payroll with the actual payment date once paid.</Alert>}
      {run.status === "DRAFT" && <Alert tone="blue">Processing recalculates attendance for the whole month, applies leave, adjustments and advance instalments, and creates a payslip for every employee who worked in the month.</Alert>}
      {run.notes && <Alert tone="amber" title="Notes">{run.notes}</Alert>}

      {tot._count._all > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Employees paid" value={int(tot._count._all)} sub={byCat.map((c) => `${c._count._all} ${label(PAYSLIP_CATEGORIES, c.category).toLowerCase()}`).join(" · ")} tone="blue" />
            <Stat label="Gross payable" value={money(s.grossPayable ?? 0, false)} sub={`after Tk ${money(s.absentDeduction ?? 0, false)} absence deduction`} />
            <Stat label="Overtime" value={money(s.otAmount ?? 0, false)} sub={`${hours(s.otHours)} h, of which ${hours(s.otHoursExcess)} h beyond the daily limit`} tone={(s.otHoursExcess ?? 0) > 0 ? "amber" : "green"} />
            <Stat label="Net pay" value={money(s.netPayable ?? 0, false)} sub={`deductions Tk ${money((s.advanceDeduction ?? 0) + (s.stamp ?? 0) + (s.tax ?? 0) + (s.otherDeduction ?? 0), false)}`} tone="green" />
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,290px)]">
            <Card title="By department" bodyClass="overflow-x-auto p-0">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th className="text-right">Employees</th>
                    <th className="text-right">Absence ded.</th>
                    <th className="text-right">OT hours</th>
                    <th className="text-right">OT amount</th>
                    <th className="text-right">Gross payable</th>
                    <th className="text-right">Net pay</th>
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
                        <td className="text-right tabular-nums">{money(x!._sum.absentDeduction ?? 0, false)}</td>
                        <td className="text-right tabular-nums">{hours(x!._sum.otHours)}</td>
                        <td className="text-right tabular-nums">{money(x!._sum.otAmount ?? 0, false)}</td>
                        <td className="text-right tabular-nums">{money(x!._sum.grossPayable ?? 0, false)}</td>
                        <td className="text-right font-medium tabular-nums">{money(x!._sum.netPayable ?? 0, false)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>
            <Card title="Payment channels">
              <ul className="space-y-2.5 text-[14px]">
                {byMode.map((m) => (
                  <li key={m.paymentMode} className="flex justify-between">
                    <span>
                      {label(PAYMENT_MODES, m.paymentMode)} <span className="text-stone-400">({m._count._all})</span>
                    </span>
                    <span className="font-medium tabular-nums">{money(m._sum.netPayable ?? 0, false)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12.5px] leading-relaxed text-label-2">Cash payments are signed over a revenue stamp on the printed wage register (Rule 111(1)).</p>
            </Card>
          </div>

          <Card title="Reports for this month">
            <div className="flex flex-wrap gap-2">
              {reports.map(([slug, l]) => (
                <Link key={slug} href={`/reports/${slug}?month=${month}&run=1`} className="btn btn-secondary btn-sm">
                  {l}
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}

      {can(user, "payroll.lock") && run.status === "PROCESSED" && (
        <Card title="Lock after payment" className="max-w-md">
          <LockForm id={run.id} due={ymd(due < today ? today : due)} />
        </Card>
      )}
      {can(user, "payroll.lock") && run.status === "LOCKED" && (
        <Card title={`Locked by ${run.lockedBy} · paid ${dmy(run.paymentDate)}`} className="max-w-md">
          <UnlockForm id={run.id} />
        </Card>
      )}
    </div>
  );
}
