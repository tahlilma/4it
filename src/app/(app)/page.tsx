import Link from "next/link";
import { Icon } from "@/components/icons";
import { Card, cx, FILL, List, ListRow, Stat, StatusBadge, type Hue } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { prisma } from "@/lib/db";
import { addDays, endOfMonth, MONTHS_EN, MONTHS_SHORT, monthLabel, startOfMonth, todayLocal, toLocal, WEEKDAYS_EN, ymd } from "@/lib/dates";
import { int, pct } from "@/lib/num";

const shortDay = (d: Date) => `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;

export default async function Dashboard() {
  const user = await requireUser();
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  // Latest fully processed day (normally yesterday; earlier if processing is behind).
  const latest = await prisma.attendanceDay.aggregate({ where: { date: { lt: today } }, _max: { date: true } });
  const yesterday = latest._max.date ?? addDays(today, -1);
  const y = today.getUTCFullYear(), m = today.getUTCMonth() + 1;
  const mStart = startOfMonth(y, m), mEnd = endOfMonth(y, m);

  const [active, byGender, byType, joined, left, trendRows, todayPunches, pendingLeave, latestRun, lefty, settlements, proposals, depts] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.employee.groupBy({ by: ["gender"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["empType"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.count({ where: { joinDate: { gte: mStart, lte: mEnd } } }),
    prisma.separation.count({ where: { effectiveDate: { gte: mStart, lte: mEnd } } }),
    prisma.attendanceDay.groupBy({ by: ["date", "status"], where: { date: { gte: addDays(yesterday, -20), lte: yesterday }, dayType: "WORKDAY" }, _count: { _all: true } }),
    prisma.punchLog.groupBy({ by: ["punchId"], where: { time: { gte: today, lt: addDays(today, 1) } } }),
    prisma.leaveApplication.count({ where: { status: "PENDING" } }),
    prisma.payrollRun.findFirst({ orderBy: [{ year: "desc" }, { month: "desc" }] }),
    prisma.leftyCase.count({ where: { status: "OPEN" } }),
    prisma.separation.count({ where: { settlementStatus: { not: "PAID" } } }),
    prisma.increment.count({ where: { status: { in: ["PROPOSED", "APPROVED"] } } }),
    prisma.department.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, nameEn: true, _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
    }),
  ]);

  // Daily attendance rate for the last 14 processed working days (weekly and festival holidays are left out).
  const byDay = new Map<string, Record<string, number>>();
  for (const r of trendRows) {
    const k = ymd(r.date);
    byDay.set(k, { ...byDay.get(k), [r.status]: r._count._all });
  }
  const trend = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, c]) => {
      const present = (c.PRESENT ?? 0) + (c.LATE ?? 0);
      const expected = present + (c.ABSENT ?? 0) + (c.LEAVE ?? 0);
      return { day, present, expected, rate: expected ? (present / expected) * 100 : null };
    })
    .filter((d) => d.rate !== null)
    .slice(-14) as { day: string; present: number; expected: number; rate: number }[];
  const last = trend.at(-1);

  const g = Object.fromEntries(byGender.map((x) => [x.gender, x._count._all]));
  const t = Object.fromEntries(byType.map((x) => [x.empType, x._count._all]));
  const hour = toLocal(new Date(), company.tzOffsetMinutes).getUTCHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const maxDept = Math.max(1, ...depts.map((d) => d._count.employees));
  const women = active ? ((g.FEMALE ?? 0) / active) * 100 : 0;
  const mix: [string, number, Hue][] = [
    ["Workers", t.WORKER ?? 0, "blue"],
    ["Staff", t.STAFF ?? 0, "purple"],
    ["Management", t.MANAGEMENT ?? 0, "orange"],
  ];

  const todo: { show: boolean; href: string; icon: "calendar" | "moon" | "door" | "trending"; color: Hue; label: string; hint: string; count: number }[] = [
    { show: can(user, "leave.view"), href: "/leave?status=PENDING", icon: "calendar", color: "purple", label: "Leave requests to decide", hint: "Approve or reject applications", count: pendingLeave },
    { show: can(user, "separation.manage"), href: "/separations/lefty", icon: "moon", color: "indigo", label: "Open lefty cases", hint: "Absence letters under s.27(3A)", count: lefty },
    { show: can(user, "separation.manage"), href: "/separations", icon: "door", color: "red", label: "Settlements not yet paid", hint: "Final dues of people who left", count: settlements },
    { show: can(user, "increment.propose"), href: "/payroll/increments", icon: "trending", color: "mint", label: "Increment proposals", hint: "Yearly increments awaiting a decision", count: proposals },
  ];

  return (
    <div className="space-y-7">
      {/* Hero */}
      <section className="denim no-print relative overflow-hidden rounded-[22px] px-6 py-6 shadow-[0_24px_48px_-28px_rgb(13_15_29/0.7)] lg:px-8 lg:py-7">
        <div className="grid items-end gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="min-w-0">
            <div className="eyebrow text-[#f2b35e]">
              {WEEKDAYS_EN[today.getUTCDay()]}, {today.getUTCDate()} {MONTHS_EN[today.getUTCMonth()]}
            </div>
            <h1 data-title={company.nameEn} className="mt-2 font-display text-[30px] leading-[1.1] font-semibold text-side-ink sm:text-[36px]">
              <span className="text-side-ink-2">{greeting},</span>
              <br />
              {user.name}
            </h1>
            <p className="mt-2 text-[14px] text-side-ink-2">
              {company.nameEn} · {int(active)} people on roll
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {can(user, "employee.edit") && (
                <Link href="/employees/new" className="btn bg-side-pill text-side-pill-ink shadow-[0_1px_2px_rgb(0_0_0/0.3)] hover:brightness-[1.03]">
                  <Icon name="user-add" strokeWidth={2} className="h-4 w-4 text-[#4549cf]" /> New Employee
                </Link>
              )}
              {can(user, "attendance.process") && (
                <Link href="/attendance/process" className="btn bg-white/[0.08] text-side-ink ring-1 ring-white/[0.12] ring-inset hover:bg-white/[0.13]">
                  <Icon name="process" strokeWidth={1.9} className="h-4 w-4" /> Process Attendance
                </Link>
              )}
              <Link href="/reports" className="btn bg-white/[0.08] text-side-ink ring-1 ring-white/[0.12] ring-inset hover:bg-white/[0.13]">
                <Icon name="document" strokeWidth={1.9} className="h-4 w-4" /> Reports
              </Link>
            </div>
          </div>
          <AttendanceTrend trend={trend} last={last} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <Stat label="Employees on roll" icon="users" tone="blue" value={int(active)} unit="active" sub={`${int(g.MALE ?? 0)} men · ${int(g.FEMALE ?? 0)} women`} href="/employees" />
        <Stat label="Punched in today" icon="device" tone="violet" value={int(todayPunches.length)} unit="IDs" sub="Live from the punch machines" href="/attendance" />
        <Stat label="This month" meta={monthLabel(y, m)} icon="trending" tone="amber" value={`+${joined}`} unit="joined" sub={`${left} separated`} />
        <Stat label="Women in the workforce" icon="heart" tone="pink" value={pct(women)} meter={women} />
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          {todo.some((x) => x.show) && (
            <List header="Needs attention">
              {todo
                .filter((x) => x.show)
                .map((x) => (
                  <ListRow
                    key={x.href}
                    href={x.href}
                    icon={x.icon}
                    color={x.color}
                    title={x.label}
                    subtitle={x.hint}
                    accessory={
                      x.count > 0 ? (
                        <span className="min-w-7 rounded-full bg-hue-orange/14 px-2 text-center text-[12.5px] leading-6 font-semibold text-ink-orange tabular-nums">{x.count}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[12.5px] font-medium text-ink-green">
                          <Icon name="check" strokeWidth={2.4} className="h-3.5 w-3.5" /> Clear
                        </span>
                      )
                    }
                  />
                ))}
            </List>
          )}

          <List header="People by department" footer="Active employees, from current records.">
            {depts.map((d) => (
              <ListRow
                key={d.id}
                title={d.nameEn}
                subtitle={active ? `${pct((d._count.employees / active) * 100)} of the workforce` : undefined}
                accessory={
                  <span className="hidden h-1.5 w-36 overflow-hidden rounded-full bg-fill-3 sm:block">
                    <span className="block h-full rounded-full bg-hue-blue" style={{ width: `${Math.max(3, (d._count.employees / maxDept) * 100)}%` }} />
                  </span>
                }
                detail={<span className="inline-block w-8 text-right font-medium text-label">{int(d._count.employees)}</span>}
              />
            ))}
          </List>
        </div>

        <div className="space-y-7">
          <List header="Payroll" footer={`Wages are due within ${company.wageDueWorkingDays} working days after the month ends (s.123). Lock the payroll once it’s paid so it can’t quietly change.`}>
            {latestRun ? (
              <ListRow
                href={can(user, "payroll.view") ? `/payroll/${latestRun.id}` : undefined}
                icon="cash"
                color="green"
                title={monthLabel(latestRun.year, latestRun.month)}
                subtitle="Latest wage month"
                accessory={<StatusBadge status={latestRun.status} />}
              />
            ) : (
              <ListRow icon="cash" color="green" title="No payroll processed yet" />
            )}
          </List>

          <Card title="Workforce mix">
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              {mix.map(([l, n, c]) => (
                <span key={l} className={cx(FILL[c], "h-full first:rounded-l-full last:rounded-r-full")} style={{ width: `${active ? (n / active) * 100 : 0}%` }} />
              ))}
            </div>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              {mix.map(([l, n, c]) => (
                <li key={l} className="flex items-center gap-2.5">
                  <span className={cx("h-2 w-2 rounded-full", FILL[c])} />
                  <span className="flex-1 text-label">{l}</span>
                  <span className="text-label-2 tabular-nums">{int(n)}</span>
                  <span className="w-12 text-right text-label-3 tabular-nums">{active ? pct((n / active) * 100) : "—"}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <p className="text-center text-[12.5px] text-label-3">Attendance figures come from processed attendance — new punches appear after Attendance → Process.</p>
    </div>
  );
}

/** 14-day attendance rate as a quiet line chart on the indigo hero. */
function AttendanceTrend({ trend, last }: { trend: { day: string; rate: number }[]; last?: { day: string; present: number; expected: number; rate: number } }) {
  if (!last) {
    return (
      <div className="rounded-[16px] bg-white/[0.06] p-4 text-[13.5px] text-side-ink-2 ring-1 ring-white/[0.08] ring-inset">
        No processed attendance yet. Run Attendance → Process to see the daily rate here.
      </div>
    );
  }
  const W = 360, H = 76, P = 5;
  const rates = trend.map((d) => d.rate);
  const lo = Math.max(0, Math.min(...rates) - 4), hi = Math.min(100, Math.max(...rates) + 2);
  const span = Math.max(1, hi - lo);
  const pts = trend.map((d, i) => [P + (trend.length > 1 ? (i / (trend.length - 1)) * (W - 2 * P) : (W - 2 * P) / 2), P + (1 - (d.rate - lo) / span) * (H - 2 * P)] as const);
  const line = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" ");
  const area = `${line} L${pts.at(-1)![0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
  const avgY = P + (1 - (avg - lo) / span) * (H - 2 * P);
  const lastDay = new Date(`${last.day}T00:00:00Z`);
  const firstDay = new Date(`${trend[0].day}T00:00:00Z`);
  return (
    <div className="rounded-[16px] bg-white/[0.06] p-4 ring-1 ring-white/[0.08] ring-inset">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[12.5px] text-side-ink-2">Attendance · {shortDay(lastDay)}</div>
          <div className="mt-1 text-[34px] leading-none font-semibold tracking-[-0.03em] text-side-ink tabular-nums">{pct(last.rate)}</div>
        </div>
        <div className="text-right text-[12.5px] leading-snug text-side-ink-2">
          {int(last.present)} of {int(last.expected)} present
          <br />
          {trend.length}-working-day average {pct(avg)}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[76px] w-full" preserveAspectRatio="none" role="img" aria-label={`Attendance rate over the last ${trend.length} working days`}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2b35e" stopOpacity="0.28" />
            <stop offset="1" stopColor="#f2b35e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trend-fill)" />
        <line x1={P} x2={W - P} y1={avgY} y2={avgY} stroke="rgb(196 200 245 / 0.45)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={line} fill="none" stroke="#f2b35e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11.5px] text-side-ink-2">
        <span>{shortDay(firstDay)}</span>
        <span>{shortDay(lastDay)}</span>
      </div>
    </div>
  );
}
