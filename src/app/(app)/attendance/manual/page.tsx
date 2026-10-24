import Link from "next/link";
import { ActionButton } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { addDays, dmy, hm, parseDate, stamp, todayLocal, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { deleteAdjust, deleteManualPunch } from "../actions";
import { AdjustForm, ManualPunchForm } from "../forms";

export default async function ManualPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("attendance.edit");
  const sp = await searchParams;
  const company = await getCompany();
  const date = parseDate(sp.date) ?? addDays(todayLocal(company.tzOffsetMinutes), -1);
  const [punches, adjusts] = await Promise.all([
    prisma.punchLog.findMany({ where: { source: "MANUAL" }, include: { employee: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.attendanceAdjust.findMany({ include: { employee: true }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Manual attendance entry"
        subtitle="For device failures, forgotten punches and official duty outside the factory. Every entry needs a reason and is shown on the audit trail; machine punches are never changed."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Add a missed punch">
          <ManualPunchForm emp={sp.emp} date={ymd(date)} />
        </Card>
        <Card title="Mark present / absent">
          <AdjustForm emp={sp.emp} date={ymd(date)} />
        </Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Recent manual punches" bodyClass="overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Punch</th>
                <th>Reason</th>
                <th>By</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {punches.map((p) => (
                <tr key={p.id}>
                  <td>{p.employee ? <Link className="link" href={`/employees/${p.employee.id}`}>{p.employee.empCode}</Link> : p.punchId}</td>
                  <td className="whitespace-nowrap">
                    {dmy(p.time)} {hm(p.time)}
                  </td>
                  <td className="text-xs">{p.reason}</td>
                  <td className="text-xs">
                    {p.createdBy}
                    <div className="text-stone-400">{stamp(p.createdAt, company.tzOffsetMinutes)}</div>
                  </td>
                  <td>
                    <ActionButton action={deleteManualPunch} fields={{ id: p.id }} label="Remove" confirm="Remove this manual punch?" />
                  </td>
                </tr>
              ))}
              {punches.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-stone-500">
                    None.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card title="Recent adjustments" bodyClass="overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Marked</th>
                <th>Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {adjusts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link className="link" href={`/employees/${a.employeeId}`}>
                      {a.employee.empCode}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{dmy(a.date)}</td>
                  <td>
                    {a.status}
                    {a.inTime && <div className="text-xs text-stone-500">{hm(a.inTime)}–{hm(a.outTime)}</div>}
                  </td>
                  <td className="text-xs">
                    {a.reason}
                    <div className="text-stone-400">{a.createdBy}</div>
                  </td>
                  <td>
                    <ActionButton action={deleteAdjust} fields={{ id: a.id }} label="Remove" confirm="Remove this adjustment?" />
                  </td>
                </tr>
              ))}
              {adjusts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-stone-500">
                    None.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
