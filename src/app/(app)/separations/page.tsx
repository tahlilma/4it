import Link from "next/link";
import { Icon } from "@/components/icons";
import { SegmentedNav } from "@/components/segmented";
import { Badge, Card, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { label, SEPARATION_TYPES } from "@/lib/constants";
import { dmy, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { workingDayCalendar } from "@/lib/deadlines";
import { money } from "@/lib/num";

export default async function SeparationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("separation.manage");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const filter = sp.status ?? "OPEN";
  const seps = await prisma.separation.findMany({
    where: filter === "OPEN" ? { settlementStatus: { not: "PAID" } } : filter === "PAID" ? { settlementStatus: "PAID" } : {},
    include: { employee: { include: { designation: true, section: true } } },
    orderBy: { effectiveDate: "desc" },
    take: 300,
  });
  const after = await workingDayCalendar();
  const due = seps.map((s) => after(s.effectiveDate, company.settlementDueWorkingDays));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Separation & final settlement"
        subtitle={`Dues must be paid within ${company.settlementDueWorkingDays} working days of separation (s.30). Remove separated employees from punch machines on their last day.`}
        actions={
          <LinkButton href="/separations/new" variant="primary">
            <Icon name="plus" strokeWidth={2.2} className="h-4 w-4" /> Record Separation
          </LinkButton>
        }
      />
      <SegmentedNav
        className="w-full sm:w-fit"
        active={filter}
        items={[
          ["OPEN", "Settlement Pending"],
          ["PAID", "Paid"],
          ["ALL", "All"],
        ].map(([k, l]) => ({ key: k, label: l, href: `/separations?status=${k}` }))}
      />
      <Card bodyClass="overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Last working day</th>
              <th>Settlement</th>
              <th className="text-right">Net payable</th>
              <th>Due by (s.30)</th>
            </tr>
          </thead>
          <tbody>
            {seps.map((s, i) => {
              const overdue = s.settlementStatus !== "PAID" && today > due[i];
              return (
                <tr key={s.id}>
                  <td>
                    <Link className="link text-[13px] font-medium tabular-nums" href={`/separations/${s.id}`}>
                      {s.employee.empCode}
                    </Link>
                    <div className="text-sm">{s.employee.nameEn}</div>
                    <div className="text-xs text-stone-500">
                      {s.employee.designation.nameEn} · {s.employee.section.nameEn}
                    </div>
                  </td>
                  <td className="text-sm">{label(SEPARATION_TYPES, s.type)}</td>
                  <td>{dmy(s.effectiveDate)}</td>
                  <td>
                    <StatusBadge status={s.settlementStatus} />
                    {s.paidOn && <div className="text-xs text-stone-500">{dmy(s.paidOn)}</div>}
                  </td>
                  <td className="text-right font-medium tabular-nums">{money(s.netPayable, false)}</td>
                  <td>{s.settlementStatus === "PAID" ? "" : overdue ? <Badge tone="red">Overdue — {dmy(due[i])}</Badge> : dmy(due[i])}</td>
                </tr>
              );
            })}
            {seps.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-stone-500">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
