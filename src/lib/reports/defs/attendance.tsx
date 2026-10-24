import type { Prisma } from "@/generated/prisma/client";
import { CompanyHeader, Sheet, Signatures } from "@/components/report/sheet";
import { bn, bnDate } from "../../bangla";
import { addDays, daysInMonth, diffDays, dmy, eachDay, endOfMonth, hm, minutesToHm, monthLabel, startOfMonth, WEEKDAYS_SHORT, ymd } from "../../dates";
import { prisma } from "../../db";
import { inChunks } from "../../chunk";
import { EMP_ORDER, employeeWhere } from "../../employee-filter";
import { statusCode } from "../../engine/attendance";
import { dayFlags, dayHours, maxConsecutiveWorked, nightConsentValid, overlapsNight, weekBuckets, type Limits } from "../../engine/compliance";
import { otRate } from "../../engine/salary";
import { hours, round2 } from "../../num";
import type { Col, Filters, Group, ReportDef, Row } from "../types";
import { groupBy, ORG_INCLUDE, secTitle, takeBatch } from "../util";

const ATT_INCLUDE = { employee: { include: ORG_INCLUDE } } satisfies Prisma.AttendanceDayInclude;
type AttRow = Prisma.AttendanceDayGetPayload<{ include: typeof ATT_INCLUDE }>;

/**
 * Processed days with each employee's record (department, section…), in register order. Employees
 * are loaded once and shared by their days: a month for a large factory is ~150k rows, and attaching
 * the employee to every row in the query would copy each record thirty times. With `batch`, only the
 * current batch of employees is loaded (see ReportDef.batch).
 */
async function daysFor(f: Filters, from: Date, to: Date, extra: Prisma.AttendanceDayWhereInput = {}, opt: { batch?: boolean } = {}): Promise<AttRow[]> {
  const empWhere = employeeWhere(f.emp, { defaultStatus: "ALL" });
  const dayWhere: Prisma.AttendanceDayWhereInput = { date: { gte: from, lte: to }, ...extra };
  let emps = await prisma.employee.findMany({ where: { AND: [empWhere, { attendance: { some: dayWhere } }] }, include: ORG_INCLUDE, orderBy: EMP_ORDER });
  if (opt.batch) emps = takeBatch(f, emps);
  if (!emps.length) return [];
  const days = await prisma.attendanceDay.findMany({
    where: { ...dayWhere, ...(opt.batch ? { employeeId: { in: emps.map((e) => e.id) } } : { employee: empWhere }) },
    orderBy: [{ employeeId: "asc" }, { date: "asc" }],
  });
  const byId = new Map(emps.map((e, i) => [e.id, { e, i }]));
  const rows: AttRow[] = [];
  for (const d of days) {
    const hit = byId.get(d.employeeId);
    if (hit) rows.push({ ...d, employee: hit.e });
  }
  return rows.sort((a, b) => byId.get(a.employeeId)!.i - byId.get(b.employeeId)!.i || a.date.getTime() - b.date.getTime());
}

const present = (s: string) => s === "PRESENT" || s === "LATE";
const isStaff = (t: string) => t !== "WORKER";

function countRow(list: AttRow[]): Row {
  const p = list.filter((d) => present(d.status)).length;
  const a = list.filter((d) => d.status === "ABSENT").length;
  const lv = list.filter((d) => d.status === "LEAVE").length;
  const off = list.filter((d) => d.status === "OFF").length;
  const expected = p + a + lv;
  return {
    roll: list.length, present: p, late: list.filter((d) => d.status === "LATE").length, absent: a, leave: lv, off,
    pct: expected ? round2((p / expected) * 100) : 0,
  };
}

const SUMMARY_COLS: Col[] = [
  { key: "roll", label: "On roll", fmt: "int", total: true },
  { key: "present", label: "Present", fmt: "int", total: true },
  { key: "late", label: "Late", fmt: "int", total: true },
  { key: "absent", label: "Absent", fmt: "int", total: true },
  { key: "leave", label: "Leave", fmt: "int", total: true },
  { key: "off", label: "Off day", fmt: "int", total: true },
  { key: "pct", label: "Present %", fmt: "pct" },
];

function rollupBy(rows: AttRow[], key: (r: AttRow) => string): Row[] {
  const m = new Map<string, AttRow[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return [...m.entries()].map(([unit, list]) => ({ unit, ...countRow(list) }));
}

function summaryBy(slug: string, title: string, unitLabel: string, key: (r: AttRow) => string, sort?: (a: AttRow, b: AttRow) => number): ReportDef {
  return {
    slug,
    group: "Attendance",
    title,
    description: `Present / late / absent / leave counts for a day by ${unitLabel.toLowerCase()}.`,
    perm: "reports.attendance",
    filters: ["date", "org", "type"],
    async run(f) {
      const rows = await daysFor(f, f.date, f.date);
      if (sort) rows.sort(sort);
      const data = rollupBy(rows, key);
      return {
        title,
        subtitle: `${WEEKDAYS_SHORT[f.date.getUTCDay()]}, ${dmy(f.date)}`,
        table: { serial: true, columns: [{ key: "unit", label: unitLabel }, ...SUMMARY_COLS], groups: [{ rows: data }] },
      };
    },
  };
}

/** Consecutive unauthorised absence ending on `date` (holidays inside the run are counted). */
async function absenceRuns(empIds: number[], date: Date): Promise<Map<number, { from: Date; days: number }>> {
  const hist = await inChunks(empIds, (slice) =>
    prisma.attendanceDay.findMany({
      where: { employeeId: { in: slice }, date: { gte: addDays(date, -90), lte: date } },
      select: { employeeId: true, date: true, status: true },
      orderBy: [{ employeeId: "asc" }, { date: "desc" }],
    }),
  );
  const by = new Map<number, typeof hist>();
  for (const h of hist) by.set(h.employeeId, [...(by.get(h.employeeId) ?? []), h]);
  const out = new Map<number, { from: Date; days: number }>();
  for (const [id, list] of by) {
    let from: Date | null = null;
    for (const d of list) {
      if (d.status === "ABSENT") from = d.date;
      else if (d.status === "OFF") continue;
      else break;
    }
    if (from) out.set(id, { from, days: diffDays(from, date) + 1 });
  }
  return out;
}

function limitsFor(company: { dailyOtLimit: number; dailyHoursLimit: number; weeklyHoursLimit: number }, buyer?: { maxOtPerDay: number; maxHoursPerWeek: number; maxConsecutiveDays: number } | null): Limits {
  return buyer
    ? { dailyOtLimit: buyer.maxOtPerDay, dailyHoursLimit: company.dailyHoursLimit, weeklyHoursLimit: buyer.maxHoursPerWeek, maxConsecutiveDays: buyer.maxConsecutiveDays }
    : { dailyOtLimit: company.dailyOtLimit, dailyHoursLimit: company.dailyHoursLimit, weeklyHoursLimit: company.weeklyHoursLimit, maxConsecutiveDays: 6 };
}

export const attendanceReports: ReportDef[] = [
  {
    slug: "attendance-register",
    group: "Attendance",
    title: "Employee Attendance Register",
    description: "Monthly attendance grid with status codes and totals per employee.",
    perm: "reports.attendance",
    filters: ["month", "emp", "org", "type", "status"],
    defaults: { month: "current", status: "ALL" },
    async run(f) {
      const from = startOfMonth(f.month.year, f.month.month), to = endOfMonth(f.month.year, f.month.month);
      const rows = await daysFor(f, from, to);
      const days = daysInMonth(f.month.year, f.month.month);
      const byEmp = new Map<number, AttRow[]>();
      for (const r of rows) byEmp.set(r.employeeId, [...(byEmp.get(r.employeeId) ?? []), r]);
      const list = [...byEmp.values()];
      const columns: Col[] = [
        { key: "code", label: "ID" },
        { key: "name", label: "Name" },
        ...Array.from({ length: days }, (_, i) => ({ key: `d${i + 1}`, label: String(i + 1), align: "center" }) as Col),
        { key: "P", label: "P", fmt: "int", total: true },
        { key: "A", label: "A", fmt: "int", total: true },
        { key: "LV", label: "Lv", fmt: "int", total: true },
        { key: "OFF", label: "W/H", fmt: "int", total: true },
        { key: "OT", label: "OT", fmt: "hours", total: true },
      ];
      return {
        title: "Employee Attendance Register",
        subtitle: `${monthLabel(f.month.year, f.month.month)} · P present, L late, A absent, W weekly holiday, H holiday, WP/HP worked holiday, leave codes`,
        layout: "legall",
        table: {
          serial: true,
          subtotals: true,
          columns,
          groups: groupBy(list, (l) => secTitle(l[0].employee), (l) => {
            const r: Row = { code: l[0].employee.empCode, name: l[0].employee.nameEn };
            for (const d of l) r[`d${d.date.getUTCDate()}`] = statusCode(d);
            r.P = l.filter((d) => present(d.status)).length;
            r.A = l.filter((d) => d.status === "ABSENT").length;
            r.LV = l.filter((d) => d.status === "LEAVE").length;
            r.OFF = l.filter((d) => d.status === "OFF").length;
            r.OT = round2(l.reduce((s, d) => s + d.otHours, 0));
            return r;
          }),
        },
      };
    },
  },
  {
    slug: "job-card",
    group: "Attendance",
    title: "Job Card (Actual, Compliance & Buyer)",
    description: "Monthly job card per employee. All formats print the same recorded punches; the compliance and buyer formats add limit checks instead of altering times.",
    perm: "reports.attendance",
    batch: 100,
    filters: ["month", "format", "buyer", "emp", "org", "status"],
    formats: [
      { value: "actual", label: "Actual (detailed)" },
      { value: "compliance", label: "Compliance — Labour Act limits" },
      { value: "buyer", label: "Buyer — code-of-conduct limits" },
    ],
    defaults: { month: "current", status: "ALL" },
    async run(f, { company }) {
      const from = startOfMonth(f.month.year, f.month.month), to = endOfMonth(f.month.year, f.month.month);
      const rows = await daysFor(f, from, to, {}, { batch: true });
      const byEmp = new Map<number, AttRow[]>();
      for (const r of rows) byEmp.set(r.employeeId, [...(byEmp.get(r.employeeId) ?? []), r]);
      const buyer = f.format === "buyer" && f.buyer ? await prisma.buyer.findUnique({ where: { id: f.buyer } }) : null;
      const limits = limitsFor(company, buyer);
      const checks = f.format !== "actual";
      const pages = [...byEmp.values()];
      return {
        title: "Job Card",
        empty: pages.length ? undefined : "No processed attendance for this month.",
        node: pages.map((days, idx) => {
          const e = days[0].employee;
          const weeks = checks ? weekBuckets(days, limits) : [];
          const otTotal = round2(days.reduce((s, d) => s + d.otHours, 0));
          const otWithin = round2(days.reduce((s, d) => s + Math.min(d.otHours, d.dayType === "WORKDAY" ? limits.dailyOtLimit : limits.dailyHoursLimit), 0));
          const leaveCodes = [...new Set(days.filter((d) => d.status === "LEAVE").map((d) => d.leaveCode ?? "LV"))];
          return (
            <Sheet key={e.id} last={idx === pages.length - 1}>
              <CompanyHeader
                company={company}
                title={`Job Card — ${monthLabel(f.month.year, f.month.month)}`}
                subtitle={f.format === "compliance" ? "Compliance format: recorded times with Labour Act limit checks" : f.format === "buyer" ? `Buyer format: limits of ${buyer?.name ?? "Labour Act (no buyer selected)"}` : undefined}
              />
              <table className="dt mb-2">
                <tbody>
                  <tr>
                    <td className="bg-neutral-50 font-medium">ID</td>
                    <td>{e.empCode}</td>
                    <td className="bg-neutral-50 font-medium">Name</td>
                    <td>{e.nameEn}</td>
                    <td className="bg-neutral-50 font-medium">Designation</td>
                    <td>{e.designation.nameEn}</td>
                  </tr>
                  <tr>
                    <td className="bg-neutral-50 font-medium">Section</td>
                    <td>{secTitle(e)}</td>
                    <td className="bg-neutral-50 font-medium">Line</td>
                    <td>{e.line?.nameEn ?? ""}</td>
                    <td className="bg-neutral-50 font-medium">Joined</td>
                    <td>{dmy(e.joinDate)}</td>
                  </tr>
                  <tr>
                    <td className="bg-neutral-50 font-medium">Shift</td>
                    <td>
                      {e.shift.inTime}–{e.shift.outTime}
                    </td>
                    <td className="bg-neutral-50 font-medium">Grade</td>
                    <td>{e.grade?.nameEn ?? ""}</td>
                    <td className="bg-neutral-50 font-medium">OT eligible</td>
                    <td>{e.otEligible ? "Yes" : "No"}</td>
                  </tr>
                </tbody>
              </table>
              <table className="dt">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Status</th>
                    <th>Late</th>
                    <th>Early out</th>
                    <th>Work h</th>
                    <th>OT h</th>
                    {checks ? <th>Limit check</th> : <th>Remarks</th>}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const flags = checks ? dayFlags(d, limits) : [];
                    return (
                      <tr key={d.id} className={flags.length ? "bg-amber-50" : ""}>
                        <td className="center">{dmy(d.date)}</td>
                        <td className="center">{WEEKDAYS_SHORT[d.date.getUTCDay()]}</td>
                        <td className="center">{hm(d.inTime)}</td>
                        <td className="center">
                          {hm(d.outTime)}
                          {d.outTime && ymd(d.outTime) !== ymd(d.date) ? "+1" : ""}
                        </td>
                        <td className="center">{statusCode(d)}</td>
                        <td className="center">{d.lateMin ? minutesToHm(d.lateMin) : ""}</td>
                        <td className="center">{d.earlyOutMin ? minutesToHm(d.earlyOutMin) : ""}</td>
                        <td className="num">{d.workMin ? hours(dayHours(d)) : ""}</td>
                        <td className="num">{d.otHours ? hours(d.otHours) : ""}</td>
                        <td className="text-[10px]">{checks ? flags.join("; ") : [d.singlePunch && "Single punch", d.adjusted && `Adjusted: ${d.remarks}`].filter(Boolean).join("; ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
                <div>Present: {days.filter((d) => present(d.status)).length}</div>
                <div>Late: {days.filter((d) => d.status === "LATE").length}</div>
                <div>Absent: {days.filter((d) => d.status === "ABSENT").length}</div>
                <div>Leave: {days.filter((d) => d.status === "LEAVE").length}{leaveCodes.length ? ` (${leaveCodes.join(", ")})` : ""}</div>
                <div>Weekly holidays: {days.filter((d) => d.dayType === "WEEKEND").length}</div>
                <div>Holidays: {days.filter((d) => d.dayType === "HOLIDAY").length}</div>
                <div>Total OT: {hours(otTotal) || 0} h</div>
                {checks && <div>OT within limit: {hours(otWithin) || 0} h · beyond: {hours(round2(otTotal - otWithin)) || 0} h</div>}
              </div>
              {checks && (
                <table className="dt mt-2">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Days worked</th>
                      <th>Hours</th>
                      <th>OT hours</th>
                      <th>Weekly limit ({limits.weeklyHoursLimit} h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w) => (
                      <tr key={ymd(w.start)}>
                        <td className="center">
                          {dmy(w.start)} – {dmy(w.end)}
                        </td>
                        <td className="center">{w.workedDays}</td>
                        <td className="num">{hours(w.hours)}</td>
                        <td className="num">{hours(w.otHours)}</td>
                        <td className="center">{w.overLimit ? "Exceeded" : "OK"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {checks && maxConsecutiveWorked(days) > limits.maxConsecutiveDays && (
                <p className="mt-1 text-[11px] font-medium">Worked {maxConsecutiveWorked(days)} consecutive days — weekly rest day not given (s.103).</p>
              )}
              <Signatures labels={["Employee", "Timekeeper / Supervisor", "HR & Compliance"]} />
            </Sheet>
          );
        }),
      };
    },
  },
  summaryBy("daily-summary", "Daily Attendance Summary Report", "Department › Section", (r) => secTitle(r.employee)),
  {
    slug: "daily-summary-requirement",
    group: "Attendance",
    title: "Daily Attendance Summary (with Employee Requirement)",
    description: "Attendance by section compared with the approved manpower requirement.",
    perm: "reports.attendance",
    filters: ["date", "org"],
    async run(f) {
      const rows = await daysFor(f, f.date, f.date);
      const budgets = await prisma.manpowerBudget.groupBy({ by: ["sectionId"], _sum: { required: true } });
      const req = new Map(budgets.map((b) => [b.sectionId, b._sum.required ?? 0]));
      const m = new Map<number, AttRow[]>();
      for (const r of rows) m.set(r.employee.sectionId, [...(m.get(r.employee.sectionId) ?? []), r]);
      const data = [...m.entries()].map(([sec, list]) => {
        const c = countRow(list);
        const need = req.get(sec) ?? 0;
        return { unit: secTitle(list[0].employee), required: need, ...c, gap: need ? Math.max(0, need - (c.present as number)) : "" };
      });
      return {
        title: "Daily Attendance Summary (with Employee Requirement)",
        subtitle: dmy(f.date),
        table: {
          serial: true,
          columns: [{ key: "unit", label: "Department › Section" }, { key: "required", label: "Requirement", fmt: "int", total: true }, ...SUMMARY_COLS, { key: "gap", label: "Short vs. requirement", fmt: "int", total: true }],
          groups: [{ rows: data }],
        },
      };
    },
  },
  {
    slug: "daily-absent",
    group: "Attendance",
    title: "Daily Absent Report",
    description: "Employees absent on a day, with how long they have been absent continuously.",
    perm: "reports.attendance",
    filters: ["date", "org", "type"],
    async run(f) {
      const rows = await daysFor(f, f.date, f.date, { status: "ABSENT" });
      const runs = await absenceRuns(rows.map((r) => r.employeeId), f.date);
      return {
        title: "Daily Absent Report",
        subtitle: `${dmy(f.date)} — ${rows.length} absent`,
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "line", label: "Line" },
            { key: "mobile", label: "Mobile" }, { key: "since", label: "Absent since", fmt: "date" }, { key: "days", label: "Days", fmt: "int" },
          ],
          groups: groupBy(rows, (r) => secTitle(r.employee), (r) => ({
            code: r.employee.empCode, name: r.employee.nameEn, desig: r.employee.designation.nameEn, line: r.employee.line?.nameEn ?? "",
            mobile: r.employee.mobile, since: runs.get(r.employeeId)?.from, days: runs.get(r.employeeId)?.days,
          })),
          grandTotal: false,
        },
      };
    },
  },
  {
    slug: "daily-present",
    group: "Attendance",
    title: "Daily Present Report",
    description: "Employees present on a day with in/out times.",
    perm: "reports.attendance",
    filters: ["date", "org", "type"],
    async run(f) {
      const rows = await daysFor(f, f.date, f.date, { status: { in: ["PRESENT", "LATE"] } });
      return {
        title: "Daily Present Report",
        subtitle: `${dmy(f.date)} — ${rows.length} present`,
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "line", label: "Line" },
            { key: "in", label: "In" }, { key: "out", label: "Out" }, { key: "late", label: "Late" }, { key: "ot", label: "OT h", fmt: "hours", total: true },
          ],
          groups: groupBy(rows, (r) => secTitle(r.employee), (r) => ({
            code: r.employee.empCode, name: r.employee.nameEn, desig: r.employee.designation.nameEn, line: r.employee.line?.nameEn ?? "",
            in: hm(r.inTime), out: hm(r.outTime), late: r.lateMin ? minutesToHm(r.lateMin) : "", ot: r.otHours,
          })),
          subtotals: true,
        },
      };
    },
  },
  {
    slug: "daily-status",
    group: "Attendance",
    title: "Daily Attendance Status Report",
    description: "Every employee's status, punches, late, early-out and OT for a day.",
    perm: "reports.attendance",
    filters: ["date", "org", "type"],
    async run(f) {
      const rows = await daysFor(f, f.date, f.date);
      return {
        title: "Daily Attendance Status Report",
        subtitle: dmy(f.date),
        layout: "a4l",
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "line", label: "Line" },
            { key: "status", label: "Status", align: "center" }, { key: "in", label: "In" }, { key: "out", label: "Out" }, { key: "late", label: "Late" },
            { key: "early", label: "Early out" }, { key: "work", label: "Work h", fmt: "hours" }, { key: "ot", label: "OT h", fmt: "hours", total: true }, { key: "remarks", label: "Remarks" },
          ],
          groups: groupBy(rows, (r) => secTitle(r.employee), (r) => ({
            code: r.employee.empCode, name: r.employee.nameEn, desig: r.employee.designation.nameEn, line: r.employee.line?.nameEn ?? "",
            status: statusCode(r), in: hm(r.inTime), out: hm(r.outTime), late: r.lateMin ? minutesToHm(r.lateMin) : "",
            early: r.earlyOutMin ? minutesToHm(r.earlyOutMin) : "", work: r.workMin ? round2(r.workMin / 60) : 0, ot: r.otHours,
            remarks: [r.singlePunch && "single punch", r.adjusted && "adjusted"].filter(Boolean).join(", "),
          })),
          subtotals: true,
        },
      };
    },
  },
  {
    slug: "single-punch",
    group: "Attendance",
    title: "Single Punch Report",
    description: "Days with only one punch (missing in or out) — to be corrected with a manual entry and reason.",
    perm: "reports.attendance",
    filters: ["range", "org"],
    async run(f) {
      const rows = await daysFor(f, f.from, f.to, { singlePunch: true });
      return {
        title: "Single Punch Report",
        subtitle: `${dmy(f.from)} – ${dmy(f.to)} — ${rows.length} days`,
        table: {
          serial: true,
          columns: [
            { key: "date", label: "Date", fmt: "date" }, { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" },
            { key: "punch", label: "Recorded punch" }, { key: "missing", label: "Missing" },
          ],
          groups: groupBy(rows, (r) => secTitle(r.employee), (r) => ({
            date: r.date, code: r.employee.empCode, name: r.employee.nameEn, desig: r.employee.designation.nameEn,
            punch: hm(r.inTime ?? r.outTime), missing: r.inTime ? "Out punch" : "In punch",
          })),
          grandTotal: false,
        },
      };
    },
  },
  {
    slug: "early-out",
    group: "Attendance",
    title: "Daily Early Out Report",
    description: "Employees who left before the end of their shift.",
    perm: "reports.attendance",
    filters: ["range", "org"],
    async run(f) {
      const rows = await daysFor(f, f.from, f.to, { earlyOutMin: { gt: 0 } });
      return {
        title: "Early Out Report",
        subtitle: `${dmy(f.from)} – ${dmy(f.to)}`,
        table: {
          serial: true,
          columns: [
            { key: "date", label: "Date", fmt: "date" }, { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" },
            { key: "shift", label: "Shift ends" }, { key: "out", label: "Left at" }, { key: "early", label: "Early by" },
          ],
          groups: groupBy(rows, (r) => secTitle(r.employee), (r) => ({
            date: r.date, code: r.employee.empCode, name: r.employee.nameEn, desig: r.employee.designation.nameEn,
            shift: r.employee.shift.outTime, out: hm(r.outTime), early: minutesToHm(r.earlyOutMin),
          })),
          grandTotal: false,
        },
      };
    },
  },
  {
    slug: "late",
    group: "Attendance",
    title: "Late Report (Daily & Monthly)",
    description: "Late arrivals for a day, or late days per employee for a month.",
    perm: "reports.attendance",
    filters: ["format", "date", "month", "org"],
    formats: [
      { value: "daily", label: "Daily" },
      { value: "monthly", label: "Monthly" },
    ],
    defaults: { month: "current" },
    async run(f, { company }) {
      if (f.format === "monthly") {
        const from = startOfMonth(f.month.year, f.month.month), to = endOfMonth(f.month.year, f.month.month);
        const rows = await daysFor(f, from, to, { status: "LATE" });
        const by = new Map<number, AttRow[]>();
        for (const r of rows) by.set(r.employeeId, [...(by.get(r.employeeId) ?? []), r]);
        return {
          title: "Monthly Late Report",
          subtitle: `${monthLabel(f.month.year, f.month.month)} · attendance bonus is lost after ${company.attBonusMaxLate} late days`,
          table: {
            serial: true,
            columns: [
              { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "days", label: "Late days", fmt: "int", total: true },
              { key: "min", label: "Total late" }, { key: "dates", label: "Dates" }, { key: "bonus", label: "Att. bonus" },
            ],
            groups: groupBy([...by.values()], (l) => secTitle(l[0].employee), (l) => ({
              code: l[0].employee.empCode, name: l[0].employee.nameEn, desig: l[0].employee.designation.nameEn, days: l.length,
              min: minutesToHm(l.reduce((s, d) => s + d.lateMin, 0)), dates: l.map((d) => d.date.getUTCDate()).join(", "),
              bonus: l.length > company.attBonusMaxLate ? "Forfeited" : "",
            })),
          },
        };
      }
      const rows = await daysFor(f, f.date, f.date, { status: "LATE" });
      return {
        title: "Daily Late Report",
        subtitle: `${dmy(f.date)} — ${rows.length} late`,
        table: {
          serial: true,
          columns: [{ key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "shift", label: "Shift starts" }, { key: "in", label: "In" }, { key: "late", label: "Late by" }],
          groups: groupBy(rows, (r) => secTitle(r.employee), (r) => ({
            code: r.employee.empCode, name: r.employee.nameEn, desig: r.employee.designation.nameEn, shift: r.employee.shift.inTime, in: hm(r.inTime), late: minutesToHm(r.lateMin),
          })),
          grandTotal: false,
        },
      };
    },
  },
  {
    slug: "absent-counseling",
    group: "Attendance",
    title: "Absent Counseling Report (Present After Absent)",
    titleBn: "অনুপস্থিতি পরবর্তী কাউন্সেলিং",
    description: "Employees who returned on a day after being absent, with a counselling form for each.",
    perm: "reports.attendance",
    filters: ["date", "format", "minDays", "org"],
    formats: [
      { value: "list", label: "List" },
      { value: "forms", label: "Counselling forms (Bangla)" },
    ],
    async run(f, { company }) {
      const back = await daysFor(f, f.date, f.date, { status: { in: ["PRESENT", "LATE"] } });
      const prev = await absenceRuns(back.map((r) => r.employeeId), addDays(f.date, -1));
      const minDays = Math.max(1, f.minDays || 1);
      const list = back.filter((r) => (prev.get(r.employeeId)?.days ?? 0) >= minDays);
      const span = (r: AttRow) => prev.get(r.employeeId)!;
      if (f.format === "forms") {
        return {
          title: "Absent Counseling",
          empty: list.length ? undefined : "Nobody returned after an absence on this day.",
          node: list.map((r, i) => (
            <Sheet key={r.id} last={i === list.length - 1}>
              <div className="font-bn text-[13px]">
                <CompanyHeader company={company} bn title="অনুপস্থিতি পরবর্তী কাউন্সেলিং ফরম" />
                <table className="dt">
                  <tbody>
                    {[
                      ["নাম", r.employee.nameBn || r.employee.nameEn],
                      ["আইডি নং", bn(r.employee.empCode)],
                      ["পদবী", r.employee.designation.nameBn || r.employee.designation.nameEn],
                      ["সেকশন", r.employee.section.nameBn || r.employee.section.nameEn],
                      ["অনুপস্থিতির সময়কাল", `${bnDate(span(r).from)} হইতে ${bnDate(addDays(f.date, -1))} পর্যন্ত (${bn(span(r).days)} দিন)`],
                      ["কাজে যোগদানের তারিখ", bnDate(f.date)],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td className="w-1/3 font-medium">{k}</td>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {["অনুপস্থিতির কারণ (শ্রমিকের বক্তব্য)", "কাউন্সেলরের পর্যবেক্ষণ ও পরামর্শ", "গৃহীত পদক্ষেপ / প্রয়োজনীয় সহায়তা"].map((h) => (
                  <div key={h} className="mt-4">
                    <div className="font-semibold">{h}:</div>
                    <div className="mt-1 h-20 border border-black" />
                  </div>
                ))}
                <p className="mt-3 text-[12px]">বিনা অনুমতিতে অনুপস্থিত থাকা শ্রম আইন অনুযায়ী অসদাচরণ হিসাবে গণ্য হইতে পারে। ছুটির প্রয়োজন হইলে আগে থেকে আবেদন করুন।</p>
                <div className="mt-14 flex justify-between text-[12px]">
                  <div className="border-t border-black px-6 pt-1">শ্রমিকের স্বাক্ষর</div>
                  <div className="border-t border-black px-6 pt-1">কাউন্সেলরের স্বাক্ষর</div>
                  <div className="border-t border-black px-6 pt-1">ব্যবস্থাপক (এইচআর)</div>
                </div>
              </div>
            </Sheet>
          )),
        };
      }
      return {
        title: "Absent Counseling Report",
        subtitle: `Returned on ${dmy(f.date)} after ${minDays}+ day(s) absent`,
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "from", label: "Absent from", fmt: "date" },
            { key: "days", label: "Days", fmt: "int" }, { key: "reason", label: "Reason (to fill)" }, { key: "sign", label: "Counsellor" },
          ],
          groups: groupBy(list, (r) => secTitle(r.employee), (r) => ({ code: r.employee.empCode, name: r.employee.nameEn, desig: r.employee.designation.nameEn, from: span(r).from, days: span(r).days, reason: "", sign: "" })),
          grandTotal: false,
        },
      };
    },
  },
  {
    slug: "ot-summary",
    group: "Attendance",
    title: "OT Summary Report (Daily & Monthly)",
    description: "Overtime hours and cost by section for a day, or per employee for a month.",
    perm: "reports.salary",
    filters: ["format", "date", "month", "org"],
    formats: [
      { value: "daily", label: "Daily (section-wise)" },
      { value: "monthly", label: "Monthly (employee-wise)" },
    ],
    defaults: { month: "current" },
    async run(f, { company }) {
      const monthly = f.format === "monthly";
      const from = monthly ? startOfMonth(f.month.year, f.month.month) : f.date;
      const to = monthly ? endOfMonth(f.month.year, f.month.month) : f.date;
      const rows = (await daysFor(f, from, to, { otHours: { gt: 0 } })).filter((r) => r.employee.otEligible);
      const rate = (r: AttRow) => otRate(r.employee.basic, company);
      if (monthly) {
        const by = new Map<number, AttRow[]>();
        for (const r of rows) by.set(r.employeeId, [...(by.get(r.employeeId) ?? []), r]);
        return {
          title: "Monthly OT Summary",
          subtitle: `${monthLabel(f.month.year, f.month.month)} (from processed attendance; the salary sheet is the payment record)`,
          table: {
            serial: true,
            subtotals: true,
            columns: [
              { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "days", label: "OT days", fmt: "int", total: true },
              { key: "hours", label: "OT hours", fmt: "hours", total: true }, { key: "over", label: `Days > ${company.dailyOtLimit} h`, fmt: "int", total: true },
              { key: "rate", label: "Rate", fmt: "money" }, { key: "amount", label: "Amount", fmt: "money", total: true },
            ],
            groups: groupBy([...by.values()], (l) => secTitle(l[0].employee), (l) => {
              const h = round2(l.reduce((s, d) => s + d.otHours, 0));
              return {
                code: l[0].employee.empCode, name: l[0].employee.nameEn, desig: l[0].employee.designation.nameEn, days: l.length, hours: h,
                over: l.filter((d) => d.dayType === "WORKDAY" && d.otHours > company.dailyOtLimit).length, rate: rate(l[0]), amount: round2(h * rate(l[0])),
              };
            }),
          },
        };
      }
      const m = new Map<string, AttRow[]>();
      for (const r of rows) m.set(secTitle(r.employee), [...(m.get(secTitle(r.employee)) ?? []), r]);
      return {
        title: "Daily OT Summary",
        subtitle: dmy(f.date),
        table: {
          serial: true,
          columns: [
            { key: "unit", label: "Department › Section" }, { key: "emps", label: "Employees on OT", fmt: "int", total: true }, { key: "hours", label: "OT hours", fmt: "hours", total: true },
            { key: "over", label: `Above ${company.dailyOtLimit} h`, fmt: "int", total: true }, { key: "amount", label: "OT cost", fmt: "money", total: true },
          ],
          groups: [
            {
              rows: [...m.entries()].map(([unit, l]) => ({
                unit, emps: l.length, hours: round2(l.reduce((s, d) => s + d.otHours, 0)),
                over: l.filter((d) => d.dayType === "WORKDAY" && d.otHours > company.dailyOtLimit).length, amount: round2(l.reduce((s, d) => s + d.otHours * rate(d), 0)),
              })),
            },
          ],
        },
      };
    },
  },
  {
    slug: "day-salary-ot",
    group: "Attendance",
    title: "Day Salary & OT Summary Report",
    description: "Daily wage cost of attendance plus overtime, by section.",
    perm: "reports.salary",
    filters: ["date", "org"],
    async run(f, { company }) {
      const rows = await daysFor(f, f.date, f.date);
      const m = new Map<string, AttRow[]>();
      for (const r of rows) m.set(secTitle(r.employee), [...(m.get(secTitle(r.employee)) ?? []), r]);
      const data = [...m.entries()].map(([unit, l]) => {
        const p = l.filter((d) => present(d.status) || d.status === "LEAVE" || d.status === "OFF");
        const daySal = round2(p.reduce((s, d) => s + d.employee.gross / 30, 0));
        const otH = round2(l.reduce((s, d) => s + (d.employee.otEligible ? d.otHours : 0), 0));
        const otA = round2(l.reduce((s, d) => s + (d.employee.otEligible ? d.otHours * otRate(d.employee.basic, company) : 0), 0));
        return { unit, roll: l.length, present: l.filter((d) => present(d.status)).length, daySal, otH, otA, total: round2(daySal + otA) };
      });
      return {
        title: "Day Salary & OT Summary",
        subtitle: `${dmy(f.date)} · day salary = gross ÷ 30 for paid days (present, paid leave, holidays)`,
        table: {
          serial: true,
          columns: [
            { key: "unit", label: "Department › Section" }, { key: "roll", label: "On roll", fmt: "int", total: true }, { key: "present", label: "Present", fmt: "int", total: true },
            { key: "daySal", label: "Day salary", fmt: "money0", total: true }, { key: "otH", label: "OT hours", fmt: "hours", total: true },
            { key: "otA", label: "OT amount", fmt: "money0", total: true }, { key: "total", label: "Total cost", fmt: "money0", total: true },
          ],
          groups: [{ rows: data }],
        },
      };
    },
  },
  summaryBy("summary-line", "Daily Attendance Summary (Line Wise)", "Line", (r) => r.employee.line?.nameEn ?? "(no line)", (a, b) => (a.employee.line?.sortOrder ?? 999) - (b.employee.line?.sortOrder ?? 999)),
  summaryBy("summary-designation", "Daily Attendance Summary (Designation Wise)", "Designation", (r) => r.employee.designation.nameEn, (a, b) => a.employee.designation.sortOrder - b.employee.designation.sortOrder),
  summaryBy("summary-machine", "Daily Attendance Summary (Machine Type Wise)", "Machine type", (r) => r.employee.machineType?.nameEn ?? "(no machine)", (a, b) => (a.employee.machineType?.sortOrder ?? 999) - (b.employee.machineType?.sortOrder ?? 999)),
  {
    slug: "ot-register",
    group: "Attendance",
    title: "Daily Attendance & Overtime Register (Form 34)",
    titleBn: "দৈনিক হাজিরা ও অধিকাল রেজিস্টার — ফরম ৩৪",
    description: "Statutory weekly register of working hours and payable overtime (s.108(3), Rule 102(4)).",
    perm: "reports.salary",
    filters: ["date", "org", "type"],
    async run(f, { company }) {
      // Week ending on the chosen date (Friday-to-Thursday columns as in Form 34).
      const end = f.date;
      const start = addDays(end, -6);
      const rows = (await daysFor(f, start, end)).filter((r) => r.employee.otEligible);
      const by = new Map<number, AttRow[]>();
      for (const r of rows) by.set(r.employeeId, [...(by.get(r.employeeId) ?? []), r]);
      const dates = eachDay(start, end);
      const groups: Group[] = groupBy([...by.values()], (l) => secTitle(l[0].employee), (l) => {
        const r: Row = { code: l[0].employee.empCode, name: l[0].employee.nameEn, desig: l[0].employee.designation.nameEn };
        dates.forEach((d, i) => {
          const day = l.find((x) => ymd(x.date) === ymd(d));
          r[`d${i}`] = day && day.workMin ? dayHours(day) : day?.status === "OFF" ? "W/H" : "";
        });
        const total = round2(l.reduce((s, d) => s + (d.workMin ? dayHours(d) : 0), 0));
        const ot = round2(l.reduce((s, d) => s + d.otHours, 0));
        const rate = otRate(l[0].employee.basic, company);
        return { ...r, total, ot, rate, amount: round2(ot * rate) };
      });
      return {
        title: "Register of Daily Attendance and Overtime — Form 34",
        titleBn: "দৈনিক হাজিরা ও অধিকাল রেজিস্টার",
        subtitle: `Week ${dmy(start)} – ${dmy(end)} · Registration no. ${company.licenseNo || "—"}`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "Card no." }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" },
            ...dates.map((d, i) => ({ key: `d${i}`, label: `${WEEKDAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()}`, fmt: "num", align: "center" }) as Col),
            { key: "total", label: "Total hours", fmt: "hours", total: true }, { key: "ot", label: "Payable OT h", fmt: "hours", total: true },
            { key: "rate", label: "Rate (2×)", fmt: "money" }, { key: "amount", label: "OT amount", fmt: "money", total: true },
          ],
          groups,
        },
        signatures: ["Prepared by", "Manager (HR & Compliance)", "Employer / Manager"],
      };
    },
  },
  {
    slug: "working-hours",
    group: "Attendance",
    title: "Working Hours Compliance Report",
    description: "Per employee: days over 10 h, days with OT over 2 h, weeks over 60 h, longest run without a rest day, and women working 10 pm – 6 am without valid consent.",
    perm: "compliance.view",
    filters: ["month", "buyer", "org"],
    defaults: { month: "current" },
    async run(f, { company }) {
      const from = startOfMonth(f.month.year, f.month.month), to = endOfMonth(f.month.year, f.month.month);
      const rows = await daysFor(f, from, to);
      const buyer = f.buyer ? await prisma.buyer.findUnique({ where: { id: f.buyer } }) : null;
      const L = limitsFor(company, buyer);
      const by = new Map<number, AttRow[]>();
      for (const r of rows) by.set(r.employeeId, [...(by.get(r.employeeId) ?? []), r]);
      const out: Row[] = [];
      for (const l of by.values()) {
        const e = l[0].employee;
        const weeks = weekBuckets(l, L);
        const night = e.gender === "FEMALE" ? l.filter((d) => present(d.status) && overlapsNight(d) && !nightConsentValid(e.nightConsentDate, e.nightConsentWithdrawn, d.date)).length : 0;
        const r = {
          code: e.empCode, name: e.nameEn, sec: secTitle(e),
          long: l.filter((d) => present(d.status) && dayHours(d) > L.dailyHoursLimit).length,
          ot: l.filter((d) => present(d.status) && d.dayType === "WORKDAY" && d.otHours > L.dailyOtLimit).length,
          maxWeek: Math.max(0, ...weeks.map((w) => w.hours)),
          weeksOver: weeks.filter((w) => w.overLimit).length,
          run: maxConsecutiveWorked(l),
          holidays: l.filter((d) => present(d.status) && d.dayType !== "WORKDAY").length,
          night,
        };
        if (r.long || r.ot || r.weeksOver || r.run > L.maxConsecutiveDays || r.holidays || r.night) out.push(r);
      }
      return {
        title: "Working Hours Compliance Report",
        subtitle: `${monthLabel(f.month.year, f.month.month)} · limits: OT ${L.dailyOtLimit} h/day, ${L.dailyHoursLimit} h/day, ${L.weeklyHoursLimit} h/week, ${L.maxConsecutiveDays} consecutive days${buyer ? ` (${buyer.name})` : " (Labour Act)"}`,
        layout: "a4l",
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "sec", label: "Section" },
            { key: "ot", label: `Days OT > ${L.dailyOtLimit} h`, fmt: "int", total: true }, { key: "long", label: `Days > ${L.dailyHoursLimit} h`, fmt: "int", total: true },
            { key: "maxWeek", label: "Max week (h)", fmt: "num" }, { key: "weeksOver", label: `Weeks > ${L.weeklyHoursLimit} h`, fmt: "int", total: true },
            { key: "run", label: "Longest run (days)", fmt: "int" }, { key: "holidays", label: "Holidays worked", fmt: "int", total: true },
            { key: "night", label: "Women 10pm–6am, no consent", fmt: "int", total: true },
          ],
          groups: [{ rows: out }],
          notes: [
            "Only employees with at least one exception are listed.",
            "Holiday work needs a substitute holiday within 3 days (s.103) or compensatory leave for festival holidays (s.118(2)).",
            "Women may work between 10 pm and 6 am only with written consent (s.109, Rule 103, Form 35).",
          ],
        },
      };
    },
  },
  billReport("tiffin-bill", "Tiffin Bill (Daily & Monthly)", "tiffin"),
  billSummary("tiffin-summary", "Tiffin Bill Summary", "tiffin"),
  billReport("night-bill", "Night Bill (Daily & Monthly)", "nightBill"),
  billSummary("night-summary", "Night Bill Summary", "nightBill"),
];

function billRate(company: { tiffinWorker: number; tiffinStaff: number; nightWorker: number; nightStaff: number }, kind: "tiffin" | "nightBill", empType: string) {
  return kind === "tiffin" ? (isStaff(empType) ? company.tiffinStaff : company.tiffinWorker) : isStaff(empType) ? company.nightStaff : company.nightWorker;
}

function billReport(slug: string, title: string, kind: "tiffin" | "nightBill"): ReportDef {
  const name = kind === "tiffin" ? "Tiffin" : "Night";
  return {
    slug,
    group: "Bills",
    title,
    description: `${name} allowance for employees whose out-punch passed the shift's ${name.toLowerCase()} threshold.`,
    perm: "reports.salary",
    filters: ["format", "date", "month", "org"],
    formats: [
      { value: "daily", label: "Daily" },
      { value: "monthly", label: "Monthly" },
    ],
    defaults: { month: "current" },
    async run(f, { company }) {
      const monthly = f.format === "monthly";
      const from = monthly ? startOfMonth(f.month.year, f.month.month) : f.date;
      const to = monthly ? endOfMonth(f.month.year, f.month.month) : f.date;
      const rows = await daysFor(f, from, to, { [kind]: true });
      if (monthly) {
        const by = new Map<number, AttRow[]>();
        for (const r of rows) by.set(r.employeeId, [...(by.get(r.employeeId) ?? []), r]);
        return {
          title: `Monthly ${name} Bill`,
          subtitle: monthLabel(f.month.year, f.month.month),
          table: {
            serial: true,
            subtotals: true,
            columns: [
              { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "days", label: "Days", fmt: "int", total: true },
              { key: "rate", label: "Rate", fmt: "money0" }, { key: "amount", label: "Amount", fmt: "money0", total: true }, { key: "sign", label: "Signature" },
            ],
            groups: groupBy([...by.values()], (l) => secTitle(l[0].employee), (l) => {
              const rate = billRate(company, kind, l[0].employee.empType);
              return { code: l[0].employee.empCode, name: l[0].employee.nameEn, desig: l[0].employee.designation.nameEn, days: l.length, rate, amount: l.length * rate, sign: "" };
            }),
          },
          signatures: ["Prepared by", "Checked by", "Approved by"],
        };
      }
      return {
        title: `Daily ${name} Bill`,
        subtitle: dmy(f.date),
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "out", label: "Out time" },
            { key: "amount", label: "Amount", fmt: "money0", total: true }, { key: "sign", label: "Signature" },
          ],
          groups: groupBy(rows, (r) => secTitle(r.employee), (r) => ({
            code: r.employee.empCode, name: r.employee.nameEn, desig: r.employee.designation.nameEn, out: hm(r.outTime), amount: billRate(company, kind, r.employee.empType), sign: "",
          })),
        },
        signatures: ["Prepared by", "Checked by", "Approved by"],
      };
    },
  };
}

function billSummary(slug: string, title: string, kind: "tiffin" | "nightBill"): ReportDef {
  return {
    slug,
    group: "Bills",
    title,
    description: `${kind === "tiffin" ? "Tiffin" : "Night"} bill totals by section for a period.`,
    perm: "reports.salary",
    filters: ["range", "org"],
    async run(f, { company }) {
      const rows = await daysFor(f, f.from, f.to, { [kind]: true });
      const m = new Map<string, AttRow[]>();
      for (const r of rows) m.set(secTitle(r.employee), [...(m.get(secTitle(r.employee)) ?? []), r]);
      return {
        title,
        subtitle: `${dmy(f.from)} – ${dmy(f.to)}`,
        table: {
          serial: true,
          columns: [
            { key: "unit", label: "Department › Section" }, { key: "emps", label: "Employees", fmt: "int", total: true }, { key: "days", label: "Bill days", fmt: "int", total: true },
            { key: "amount", label: "Amount", fmt: "money0", total: true },
          ],
          groups: [
            {
              rows: [...m.entries()].map(([unit, l]) => ({
                unit, emps: new Set(l.map((d) => d.employeeId)).size, days: l.length, amount: l.reduce((s, d) => s + billRate(company, kind, d.employee.empType), 0),
              })),
            },
          ],
        },
      };
    },
  };
}
