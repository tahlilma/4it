import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, KV, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { label, SEPARATION_TYPES } from "@/lib/constants";
import { dmy, stamp, todayLocal, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { workingDaysAfter } from "@/lib/deadlines";
import { money } from "@/lib/num";
import { PaidForm, RecalcForm, ReinstateForm } from "../forms";

export default async function SeparationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePerm("separation.manage");
  const { id } = await params;
  const sp = await searchParams;
  const sep = await prisma.separation.findUnique({
    where: { id: Number(id) },
    include: { employee: { include: { designation: true, section: true, department: true, devices: { where: { removedAt: null }, include: { device: true } } } } },
  });
  if (!sep) notFound();
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const due = await workingDaysAfter(sep.effectiveDate, company.settlementDueWorkingDays);
  const e = sep.employee;
  const lines: [string, number, string?][] = [
    ["Unpaid wages for the final month", sep.unpaidSalary, sep.unpaidDays ? `${sep.unpaidDays} payable days` : "covered by payroll"],
    ["Unpaid overtime", sep.unpaidOtAmount, sep.unpaidOtHours ? `${sep.unpaidOtHours} h` : undefined],
    ["Service benefit / compensation", sep.serviceBenefit, `${sep.benefitDays} days`],
    ["Earned leave encashment (s.11)", sep.elAmount, `${sep.elDays} days`],
    ["Wages in lieu of notice", sep.noticePay, sep.noticePayDays ? `${sep.noticePayDays} days` : undefined],
    ["Other payable", sep.otherAddition],
  ];
  const deductions: [string, number, string?][] = [
    ["Notice shortfall (s.27(2))", sep.noticeDeduction, sep.noticeDeductDays ? `${sep.noticeDeductDays} days` : undefined],
    ["Outstanding advance", sep.advanceDeduction],
    ["Other deduction", sep.otherDeduction],
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/separations", label: "Separations" }}
        title={
          <span className="flex items-center gap-3">
            {e.nameEn} <StatusBadge status={sep.settlementStatus} />
          </span>
        }
        subtitle={`${e.empCode} · ${label(SEPARATION_TYPES, sep.type)} · last working day ${dmy(sep.effectiveDate)}`}
        actions={
          <>
            <LinkButton href={`/employees/${e.id}`}>Personal file</LinkButton>
            <LinkButton href={`/reports/final-settlement?emp=${e.empCode}&run=1&status=ALL`} variant="primary">
              Print settlement bill
            </LinkButton>
          </>
        }
      />
      {sp.created && <Alert tone="green">Separation recorded and settlement calculated. Review it, then record payment.</Alert>}
      {e.devices.length > 0 && (
        <Alert tone="red" title="Access not yet removed">
          Still enrolled on: {e.devices.map((d) => d.device.name).join(", ")}. Remove from{" "}
          <Link className="underline" href="/attendance/devices">
            Punch machines
          </Link>{" "}
          and collect the ID card.
        </Alert>
      )}
      {sep.settlementStatus !== "PAID" && today > due && <Alert tone="red">Payment was due by {dmy(due)} (s.30).</Alert>}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card title="Settlement">
            <KV
              cols={4}
              items={[
                ["Joined", dmy(e.joinDate)],
                ["Service", sep.serviceText],
                ["Basic", money(sep.basic)],
                ["Gross", money(sep.gross)],
                ["Notice given", `${sep.noticeDaysGiven} days`],
                ["Notice date", dmy(sep.noticeDate)],
                ["Calculated", stamp(sep.calculatedAt, company.tzOffsetMinutes)],
                ["Due by", dmy(due)],
              ]}
            />
            <table className="tbl mt-4">
              <tbody>
                {lines.map(([l, v, note]) => (
                  <tr key={l}>
                    <td>
                      {l}
                      {note && <span className="ml-2 text-xs text-stone-500">({note})</span>}
                    </td>
                    <td className="text-right tabular-nums">{money(v)}</td>
                  </tr>
                ))}
                {deductions.map(([l, v, note]) => (
                  <tr key={l}>
                    <td className="text-ink-red">
                      Less: {l}
                      {note && <span className="ml-2 text-xs text-stone-500">({note})</span>}
                    </td>
                    <td className="text-right tabular-nums text-ink-red">{v ? `(${money(v)})` : money(0)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="font-semibold">Net payable</td>
                  <td className="text-right text-lg font-semibold tabular-nums">{money(sep.netPayable)}</td>
                </tr>
              </tbody>
            </table>
            {sep.remarks && <p className="mt-3 text-sm text-stone-600">Remarks: {sep.remarks}</p>}
            <p className="mt-3 text-xs text-stone-500">Reason recorded: {sep.reason}</p>
          </Card>
        </div>
        <div className="space-y-5">
          {sep.settlementStatus !== "PAID" && (
            <Card title="Adjust & recalculate">
              <RecalcForm id={sep.id} otherAddition={sep.otherAddition} otherDeduction={sep.otherDeduction} remarks={sep.remarks} />
            </Card>
          )}
          {sep.settlementStatus === "CALCULATED" && can(user, "settlement.approve") && (
            <Card title="Payment">
              <PaidForm id={sep.id} today={ymd(today)} />
            </Card>
          )}
          {sep.settlementStatus === "PAID" && (
            <Card title="Paid">
              <p className="text-sm">Paid on {dmy(sep.paidOn)}. Any outstanding advance was recovered from this settlement.</p>
            </Card>
          )}
          {sep.settlementStatus !== "PAID" && (
            <Card title="Entered by mistake?">
              <ReinstateForm id={sep.id} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
