import Link from "next/link";
import { ActionButton } from "@/components/form";
import { Card, LinkButton, PageHeader, Pager, StatusBadge } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { dmy, endOfMonth, parseMonth, startOfMonth, todayLocal, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { qs, str, type SP } from "@/lib/employee-filter";
import { cancelLeave, decideLeave } from "./actions";
import { LeaveForm } from "./leave-form";

const PAGE = 50;

export default async function LeavePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePerm("leave.view");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const status = str(sp.status);
  const month = parseMonth(str(sp.month));
  const q = str(sp.q);
  const types = await prisma.leaveType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const where = {
    ...(status ? { status } : {}),
    ...(str(sp.type) ? { leaveTypeId: Number(str(sp.type)) } : {}),
    ...(month ? { fromDate: { lte: endOfMonth(month.year, month.month) }, toDate: { gte: startOfMonth(month.year, month.month) } } : {}),
    ...(q ? { employee: { OR: [{ empCode: { contains: q } }, { nameEn: { contains: q } }] } } : {}),
  };
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const [total, apps] = await Promise.all([
    prisma.leaveApplication.count({ where }),
    prisma.leaveApplication.findMany({
      where,
      include: { employee: { include: { section: true } }, leaveType: true },
      orderBy: [{ status: "desc" }, { fromDate: "desc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
  ]);
  const canDecide = can(user, "leave.approve");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Leave applications"
        subtitle="Casual 10 days (s.115), sick 14 days (s.116), earned 1 day / 18 days worked (s.117), maternity 16 weeks (s.46). Festival holidays are in the holiday calendar."
        actions={can(user, "reports.hr") && <LinkButton href="/reports/leave-balances">Leave balances</LinkButton>}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <form method="get" className="card grid grid-cols-2 gap-3 p-3 sm:grid-cols-5">
            <div className="col-span-2">
              <label className="label">Employee</label>
              <input name="q" defaultValue={q} className="input" placeholder="ID or name" />
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" defaultValue={status} className="input">
                <option value="">All</option>
                {["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select name="type" defaultValue={str(sp.type)} className="input">
                <option value="">All</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Month</label>
              <input type="month" name="month" defaultValue={str(sp.month)} className="input" />
            </div>
            <div className="col-span-2 flex items-end gap-2 sm:col-span-5">
              <button className="btn btn-primary">Apply</button>
              <a href="/leave" className="btn btn-ghost">
                Reset
              </a>
            </div>
          </form>
          <Card bodyClass="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave</th>
                  <th>Period</th>
                  <th className="text-right">Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/employees/${a.employeeId}?tab=leave`} className="link text-[13px] font-medium tabular-nums">
                        {a.employee.empCode}
                      </Link>
                      <div className="text-sm">{a.employee.nameEn}</div>
                      <div className="text-xs text-stone-500">{a.employee.section.nameEn}</div>
                    </td>
                    <td>{a.leaveType.code}</td>
                    <td className="whitespace-nowrap text-sm">
                      {dmy(a.fromDate)}
                      <div className="text-xs text-stone-500">to {dmy(a.toDate)}</div>
                    </td>
                    <td className="text-right">{a.days}</td>
                    <td className="max-w-48 text-xs">{a.reason}</td>
                    <td>
                      <StatusBadge status={a.status} />
                      {a.decidedBy && <div className="text-[10px] text-stone-400">{a.decidedBy}</div>}
                    </td>
                    <td>
                      <div className="flex flex-col items-end gap-1">
                        {canDecide && a.status === "PENDING" && (
                          <>
                            <ActionButton action={decideLeave} fields={{ id: a.id, decision: "APPROVED" }} label="Approve" variant="success" />
                            <ActionButton action={decideLeave} fields={{ id: a.id, decision: "REJECTED" }} label="Reject" confirm="Reject this application?" />
                          </>
                        )}
                        {canDecide && a.status === "APPROVED" && <ActionButton action={cancelLeave} fields={{ id: a.id }} label="Cancel" confirmLabel="Cancel Leave" confirm="Cancel this approved leave? Attendance will be re-processed." />}
                        <Link className="text-[12.5px] text-ink-blue hover:underline" href={`/reports/leave-application?emp=${a.employee.empCode}&app=${a.id}&run=1&status=ALL`}>
                          Print form
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {apps.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-stone-500">
                      No applications.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pager page={page} pages={Math.ceil(total / PAGE)} makeHref={(p) => `/leave${qs(sp, { page: p })}`} />
          </Card>
        </div>
        {can(user, "leave.edit") && (
          <Card title="New leave application" className="h-fit">
            <LeaveForm types={types.map((t) => ({ value: t.id, label: `${t.code} — ${t.nameEn}` }))} today={ymd(today)} canApprove={canDecide} emp={str(sp.emp) || undefined} />
          </Card>
        )}
      </div>
    </div>
  );
}
