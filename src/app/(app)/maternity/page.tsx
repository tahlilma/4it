import Link from "next/link";
import { Alert, Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { dmy, todayLocal, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { money } from "@/lib/num";
import { MaternityForm, MaternityStep } from "../separations/forms";

export default async function MaternityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("leave.approve");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const cases = await prisma.maternityCase.findMany({ include: { employee: { include: { section: true } } }, orderBy: { expectedDelivery: "desc" } });
  const t = ymd(today);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Maternity benefit"
        subtitle="ss.45–50: 16 weeks (8 before and 8 after delivery) at the average daily wage of the 3 months before notice; payable after 6 months' service and when the worker has fewer than two surviving children."
      />
      {sp.case && <Alert tone="green">Case opened.</Alert>}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Cases" className="xl:col-span-2" bodyClass="overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Expected delivery</th>
                <th>Leave</th>
                <th className="text-right">Avg daily wage</th>
                <th className="text-right">Benefit</th>
                <th>Instalments</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className={sp.case === String(c.id) ? "bg-hue-blue/[0.08]" : ""}>
                  <td>
                    <Link className="link text-[13px] font-medium tabular-nums" href={`/employees/${c.employeeId}`}>
                      {c.employee.empCode}
                    </Link>
                    <div className="text-sm">{c.employee.nameEn}</div>
                    <div className="text-xs text-stone-500">{c.employee.section.nameEn}</div>
                  </td>
                  <td>
                    {dmy(c.expectedDelivery)}
                    {c.actualDelivery && <div className="text-xs text-stone-500">delivered {dmy(c.actualDelivery)}</div>}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {dmy(c.leaveFrom)} – {dmy(c.leaveTo)}
                  </td>
                  <td className="text-right tabular-nums">{money(c.avgDailyWage)}</td>
                  <td className="text-right tabular-nums">
                    {c.benefitEligible ? money(c.totalBenefit, false) : <Badge tone="amber" title={c.remarks}>Leave only</Badge>}
                  </td>
                  <td className="text-xs">
                    {c.benefitEligible && (
                      <div className="space-y-1">
                        <div>
                          1st {money(c.firstInstallment, false)}: {c.firstPaidOn ? <Badge tone="green">{dmy(c.firstPaidOn)}</Badge> : <MaternityStep id={c.id} op="first" label="Paid" today={t} />}
                        </div>
                        <div>
                          2nd {money(c.secondInstallment, false)}: {c.secondPaidOn ? <Badge tone="green">{dmy(c.secondPaidOn)}</Badge> : <MaternityStep id={c.id} op="second" label="Paid" today={t} />}
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                    <div className="mt-1 flex flex-col gap-1">
                      {!c.actualDelivery && c.status !== "CLOSED" && <MaternityStep id={c.id} op="delivered" label="Delivered" today={t} />}
                      {c.status !== "CLOSED" && <MaternityStep id={c.id} op="close" label="Close" today={t} />}
                      <Link className="text-[12.5px] text-ink-blue hover:underline" href={`/reports/maternity-benefit?case=${c.id}&run=1&status=ALL`}>
                        Statement
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    No maternity cases.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card title="New case (on notice — Form 18)" className="h-fit">
          <MaternityForm today={t} />
        </Card>
      </div>
    </div>
  );
}
