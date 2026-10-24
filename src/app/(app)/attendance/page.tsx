import Link from "next/link";
import { Icon } from "@/components/icons";
import { EmpFilterBar } from "@/components/emp-filters";
import { Badge, Card, LinkButton, PageHeader, Pager, Stat } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { addDays, dmy, hm, minutesToHm, parseDate, todayLocal, WEEKDAYS_EN, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { EMP_ORDER, employeeWhere, parseEmpFilter, qs, str, type SP } from "@/lib/employee-filter";
import { statusCode } from "@/lib/engine/attendance";
import { int } from "@/lib/num";

/** Rows per page: a whole factory day (thousands of rows) would be too heavy for modest PCs and phones. */
const PAGE = 100;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePerm("attendance.view");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const date = parseDate(str(sp.date)) ?? addDays(today, -1);
  const status = str(sp.st);
  const empWhere = employeeWhere(parseEmpFilter(sp), { defaultStatus: "ALL" });
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const where = { date, employee: empWhere, ...(status ? (status === "PRESENT" ? { status: { in: ["PRESENT", "LATE"] } } : { status }) : {}) };

  const [shown, rows] = await Promise.all([
    prisma.attendanceDay.count({ where }),
    prisma.attendanceDay.findMany({
      where,
      include: { employee: { include: { designation: true, section: true, line: true } } },
      orderBy: EMP_ORDER.map((o) => ({ employee: o })),
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
  ]);
  const all = await prisma.attendanceDay.groupBy({ by: ["status"], where: { date, employee: empWhere }, _count: { _all: true } });
  const c = Object.fromEntries(all.map((x) => [x.status, x._count._all]));
  const present = (c.PRESENT ?? 0) + (c.LATE ?? 0);
  const rawPunches = await prisma.punchLog.count({ where: { time: { gte: date, lt: addDays(date, 1) } } });

  const nav = (d: Date) => `/attendance${qs(sp, { date: ymd(d), page: null })}`;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Daily attendance"
        subtitle={`${WEEKDAYS_EN[date.getUTCDay()]}, ${dmy(date)} · ${int(rawPunches)} raw punches on this date · ${int(shown)} ${shown === 1 ? "row" : "rows"}`}
        actions={
          <>
            <LinkButton href={nav(addDays(date, -1))}>
              <Icon name="chevron-left" strokeWidth={2.2} className="h-3.5 w-3.5" /> Previous Day
            </LinkButton>
            <LinkButton href={nav(addDays(date, 1))}>
              Next Day <Icon name="chevron-right" strokeWidth={2.2} className="h-3.5 w-3.5" />
            </LinkButton>
            {can(user, "attendance.process") && (
              <LinkButton href={`/attendance/process?from=${ymd(date)}&to=${ymd(date)}`} variant="primary">
                Re-process this date
              </LinkButton>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Present" value={int(present)} tone="green" href={`/attendance${qs(sp, { st: "PRESENT", page: null })}`} />
        <Stat label="Late" value={int(c.LATE ?? 0)} tone="amber" href={`/attendance${qs(sp, { st: "LATE", page: null })}`} />
        <Stat label="Absent" value={int(c.ABSENT ?? 0)} tone="red" href={`/attendance${qs(sp, { st: "ABSENT", page: null })}`} />
        <Stat label="On leave" value={int(c.LEAVE ?? 0)} tone="blue" href={`/attendance${qs(sp, { st: "LEAVE", page: null })}`} />
        <Stat label="Off day" value={int(c.OFF ?? 0)} href={`/attendance${qs(sp, { st: "OFF", page: null })}`} />
      </div>
      <EmpFilterBar sp={sp} action="/attendance" show={["q", "dept", "sec", "line", "type"]}>
        <input type="hidden" name="date" value={ymd(date)} />
        <div>
          <label className="label">Status</label>
          <select name="st" defaultValue={status} className="input">
            <option value="">All</option>
            <option value="PRESENT">Present (incl. late)</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="LEAVE">Leave</option>
            <option value="OFF">Off day</option>
          </select>
        </div>
      </EmpFilterBar>
      <Card bodyClass="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Section / line</th>
              <th>In</th>
              <th>Out</th>
              <th>Status</th>
              <th className="text-right">Late</th>
              <th className="text-right">Early out</th>
              <th className="text-right">Work</th>
              <th className="text-right">OT h</th>
              <th>Flags</th>
              {can(user, "attendance.edit") && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-[13px] tabular-nums">
                  <Link className="link" href={`/employees/${r.employeeId}?tab=attendance&m=${ymd(date).slice(0, 7)}`}>
                    {r.employee.empCode}
                  </Link>
                </td>
                <td>
                  {r.employee.nameEn}
                  <div className="text-xs text-stone-500">{r.employee.designation.nameEn}</div>
                </td>
                <td className="text-xs">
                  {r.employee.section.nameEn}
                  {r.employee.line && <div className="text-stone-500">{r.employee.line.nameEn}</div>}
                </td>
                <td className="tabular-nums">{hm(r.inTime)}</td>
                <td className="tabular-nums">
                  {hm(r.outTime)}
                  {r.outTime && ymd(r.outTime) !== ymd(r.date) && <span className="text-xs text-stone-400"> +1</span>}
                </td>
                <td>
                  <Badge tone={r.status === "ABSENT" ? "red" : r.status === "LATE" ? "amber" : r.status === "LEAVE" ? "blue" : r.status === "OFF" ? "slate" : "green"}>{statusCode(r)}</Badge>
                </td>
                <td className="text-right tabular-nums">{r.lateMin ? minutesToHm(r.lateMin) : ""}</td>
                <td className="text-right tabular-nums">{r.earlyOutMin ? minutesToHm(r.earlyOutMin) : ""}</td>
                <td className="text-right tabular-nums">{r.workMin ? minutesToHm(r.workMin) : ""}</td>
                <td className="text-right tabular-nums">{r.otHours || ""}</td>
                <td className="space-x-1 text-xs">
                  {r.singlePunch && <Badge tone="amber">Single punch</Badge>}
                  {r.adjusted && <Badge tone="violet" title={r.remarks}>Adjusted</Badge>}
                  {r.tiffin && <Badge>Tiffin</Badge>}
                  {r.nightBill && <Badge>Night</Badge>}
                </td>
                {can(user, "attendance.edit") && (
                  <td className="text-right">
                    <Link className="btn btn-ghost btn-sm" href={`/attendance/manual?emp=${r.employee.empCode}&date=${ymd(date)}`}>
                      Correct
                    </Link>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-10 text-center text-stone-500">
                  No processed attendance for this date and filter. {rawPunches > 0 && "Punches exist — process the date to see them here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager page={page} pages={Math.ceil(shown / PAGE)} makeHref={(p) => `/attendance${qs(sp, { page: p })}`} />
      </Card>
    </div>
  );
}
