import "server-only";
// Live compliance checks against the Bangladesh Labour Act 2006, Labour Rules 2015, the RMG wage
// gazette and common buyer-audit points (amfori BSCI, WRAP, SMETA, C-TPAT).

import { addDays, addMonths, ageOn, diffDays, dmy, endOfMonth, minDate, monthLabel, startOfMonth, ymd } from "../dates";
import { prisma } from "../db";
import { dayHours, maxConsecutiveWorked, nightConsentValid, overlapsNight, weekBuckets } from "../engine/compliance";
import { round2 } from "../num";
import { workingDayCalendar } from "../deadlines";
import { lastIncrementDates } from "./increment";
import type { CompanyRow } from "../company";

export type Severity = "high" | "medium" | "low";

export interface CheckItem {
  label: string;
  detail?: string;
  href?: string;
}

export interface CheckResult {
  key: string;
  area: string;
  title: string;
  law: string;
  severity: Severity;
  count: number;
  items: CheckItem[];
  href?: string;
  note?: string;
}

const emp = (e: { id: number; empCode: string; nameEn: string }, detail?: string): CheckItem => ({ label: `${e.empCode} — ${e.nameEn}`, detail, href: `/employees/${e.id}` });

export async function runCompliance(company: CompanyRow, today: Date, month: { year: number; month: number }): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const add = (r: Omit<CheckResult, "count"> & { count?: number }) => out.push({ ...r, count: r.count ?? r.items.length, items: r.items.slice(0, 12) });

  const active = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    include: { grade: true, designation: true, nominees: { select: { id: true } }, devices: { where: { removedAt: null }, select: { id: true } } },
  });

  // ── Workforce & personal file ──
  add({
    key: "age", area: "Workforce", title: `Employees younger than the minimum hiring age (${company.minHiringAge})`, law: "BLA s.34; buyer codes (child labour)", severity: "high",
    items: active.filter((e) => ageOn(e.dob, today) < company.minHiringAge).map((e) => emp(e, `age ${ageOn(e.dob, today)}`)),
  });
  add({
    key: "ageproof", area: "Workforce", title: "No NID or birth registration on file (age proof)", law: "BLA s.34–36; Rule 34", severity: "medium",
    items: active.filter((e) => !e.nidNo && !e.birthRegNo).map((e) => emp(e)),
  });
  const docs: [string, (e: (typeof active)[number]) => boolean, string, Severity][] = [
    ["appointment letter", (e) => !e.appointmentLetterDate, "Rule 19(1)", "high"],
    ["ID card (Form 6)", (e) => !e.idCardIssueDate, "BLA s.5; Rule 19(5)", "high"],
    ["nominee form (Form 41)", (e) => !e.nomineeFormDate || e.nominees.length === 0, "Rule 118(1)", "medium"],
    ["age & fitness certificate (Form 15)", (e) => !e.fitnessCertDate, "Rule 34(1)", "medium"],
  ];
  for (const [name, test, law, sev] of docs) {
    add({ key: `doc-${name}`, area: "Personal file", title: `Missing ${name}`, law, severity: sev, items: active.filter(test).map((e) => emp(e)) });
  }
  add({
    key: "servicebook", area: "Personal file", title: "Service book not opened within 15 days of confirmation", law: "BLA s.6; Rule 22(1)", severity: "medium",
    items: active.filter((e) => e.confirmDate && !e.serviceBookDate && diffDays(e.confirmDate, today) > 15).map((e) => emp(e, `confirmed ${dmy(e.confirmDate)}`)),
  });
  add({
    key: "probation", area: "Personal file", title: "Probation ended but employee not confirmed", law: "BLA s.4(7)–(8): probation 3 months (6 for clerical), extendable once by 3 months for skilled workers", severity: "medium",
    items: active
      .filter((e) => e.employmentNature === "PROBATION" && e.probationEnd && e.probationEnd < today)
      .map((e) => emp(e, `probation ended ${dmy(e.probationEnd)}`)),
  });

  // ── Wages ──
  add({
    key: "minwage", area: "Wages", title: "Workers paid below their grade minimum wage", law: "Minimum Wages gazette (RMG); BLA s.149", severity: "high",
    items: active.filter((e) => e.empType === "WORKER" && e.grade && e.grade.minGross > 0 && e.gross < e.grade.minGross).map((e) => emp(e, `gross ${e.gross} < ${e.grade!.minGross}`)),
  });
  add({
    key: "structure", area: "Wages", title: "Salary components don't add up to gross", law: "Wage structure per gazette", severity: "low",
    items: active.filter((e) => Math.abs(round2(e.basic + e.houseRent + e.medical + e.transport + e.food + e.otherAllowance) - e.gross) > 1).map((e) => emp(e)),
  });
  const runs = await prisma.payrollRun.findMany({ where: { status: { not: "LOCKED" } } });
  const after = await workingDayCalendar();
  const lateRuns: CheckItem[] = [];
  for (const r of runs) {
    const due = after(endOfMonth(r.year, r.month), company.wageDueWorkingDays);
    if (today > due) lateRuns.push({ label: monthLabel(r.year, r.month), detail: `due ${dmy(due)} — not locked as paid`, href: `/payroll/${r.id}` });
  }
  add({ key: "wagedue", area: "Wages", title: "Wages not recorded as paid within 7 working days", law: "BLA s.123", severity: "high", items: lateRuns, href: "/payroll" });
  const lastInc = await lastIncrementDates(prisma, active.map((e) => e.id));
  add({
    key: "increment", area: "Wages", title: `Annual increment overdue (more than 12 months since joining or last increment)`, law: `RMG gazette: ${company.incrementPercent}% of basic yearly`, severity: "medium",
    items: active
      .filter((e) => e.empType === "WORKER")
      .filter((e) => addMonths(lastInc.get(e.id) ?? e.joinDate, 13) < today)
      .map((e) => emp(e, `since ${dmy(lastInc.get(e.id) ?? e.joinDate)}`)),
    href: "/payroll/increments",
  });
  const bonusRuns = await prisma.bonusRun.count({ where: { cutoffDate: { gte: addMonths(today, -12) } } });
  add({
    key: "bonus", area: "Wages", title: "Fewer than two festival bonuses in the last 12 months", law: "Labour Rules r.111(5)", severity: "medium",
    items: bonusRuns >= 2 ? [] : [{ label: `${bonusRuns} bonus sheet(s) in the last 12 months`, href: "/payroll/bonus" }],
    note: "Every worker with one year of service must receive two festival bonuses a year.",
  });

  // ── Working hours (selected month) ──
  const from = startOfMonth(month.year, month.month);
  const to = minDate(endOfMonth(month.year, month.month), addDays(today, -1));
  const days = await prisma.attendanceDay.findMany({
    where: { date: { gte: from, lte: to } },
    select: { employeeId: true, date: true, dayType: true, status: true, workMin: true, otMin: true, otHours: true, inTime: true, outTime: true },
    orderBy: [{ employeeId: "asc" }, { date: "asc" }],
  });
  const byEmp = new Map<number, typeof days>();
  for (const d of days) byEmp.set(d.employeeId, [...(byEmp.get(d.employeeId) ?? []), d]);
  const empMap = new Map((await prisma.employee.findMany({ where: { id: { in: [...byEmp.keys()] } }, select: { id: true, empCode: true, nameEn: true, gender: true, nightConsentDate: true, nightConsentWithdrawn: true } })).map((e) => [e.id, e]));
  const L = { dailyOtLimit: company.dailyOtLimit, dailyHoursLimit: company.dailyHoursLimit, weeklyHoursLimit: company.weeklyHoursLimit, maxConsecutiveDays: 6 };
  const ot: CheckItem[] = [], long: CheckItem[] = [], week: CheckItem[] = [], rest: CheckItem[] = [], night: CheckItem[] = [], hol: CheckItem[] = [];
  let otDays = 0;
  for (const [id, list] of byEmp) {
    const e = empMap.get(id);
    if (!e) continue;
    const worked = list.filter((d) => d.status === "PRESENT" || d.status === "LATE");
    const o = worked.filter((d) => d.dayType === "WORKDAY" && d.otHours > L.dailyOtLimit);
    otDays += o.length;
    if (o.length) ot.push(emp(e, `${o.length} day(s), max ${Math.max(...o.map((d) => d.otHours))} h`));
    const lg = worked.filter((d) => dayHours(d) > L.dailyHoursLimit);
    if (lg.length) long.push(emp(e, `${lg.length} day(s)`));
    const wk = weekBuckets(list, L).filter((w) => w.overLimit);
    if (wk.length) week.push(emp(e, wk.map((w) => `${w.hours} h (week of ${dmy(w.start)})`).join("; ")));
    const run = maxConsecutiveWorked(list);
    if (run > L.maxConsecutiveDays) rest.push(emp(e, `${run} days in a row`));
    const h = worked.filter((d) => d.dayType !== "WORKDAY");
    if (h.length) hol.push(emp(e, h.map((d) => ymd(d.date).slice(8)).join(", ")));
    if (e.gender === "FEMALE") {
      const n = worked.filter((d) => overlapsNight(d) && !nightConsentValid(e.nightConsentDate, e.nightConsentWithdrawn, d.date));
      if (n.length) night.push(emp(e, n.map((d) => dmy(d.date)).join(", ")));
    }
  }
  const mLabel = monthLabel(month.year, month.month);
  const ref = `/reports/working-hours?run=1&month=${ymd(from).slice(0, 7)}`;
  add({ key: "ot", area: "Working hours", title: `Overtime above ${L.dailyOtLimit} h on a working day — ${mLabel}`, law: "BLA s.100, s.108 (exemption needed beyond 2 h)", severity: "medium", items: ot, href: ref, note: `${otDays} employee-day(s). All hours are paid in the salary sheet.` });
  add({ key: "long", area: "Working hours", title: `Working days longer than ${L.dailyHoursLimit} h — ${mLabel}`, law: "BLA s.100", severity: "high", items: long, href: ref });
  add({ key: "week", area: "Working hours", title: `Weeks over ${L.weeklyHoursLimit} h — ${mLabel}`, law: "BLA s.102", severity: "high", items: week, href: ref });
  add({ key: "rest", area: "Working hours", title: `No weekly rest day (more than 6 consecutive days) — ${mLabel}`, law: "BLA s.103", severity: "high", items: rest, href: ref });
  add({ key: "holiday", area: "Working hours", title: `Worked on weekly / festival holidays — ${mLabel}`, law: "BLA s.103 (substitute holiday within 3 days), s.118(2)", severity: "low", items: hol, href: `/reports/holiday-sheet?run=1&month=${ymd(from).slice(0, 7)}`, note: "Make sure a substitute / compensatory holiday was given." });
  add({ key: "night", area: "Working hours", title: `Women working 10 pm – 6 am without valid consent — ${mLabel}`, law: "BLA s.109; Rule 103 (Form 35, valid 12 months)", severity: "high", items: night, href: ref });

  // ── Separation & access ──
  const seps = await prisma.separation.findMany({ where: { settlementStatus: { not: "PAID" } }, include: { employee: true } });
  const overdue: CheckItem[] = [];
  for (const s of seps) {
    const due = after(s.effectiveDate, company.settlementDueWorkingDays);
    if (today > due) overdue.push({ label: `${s.employee.empCode} — ${s.employee.nameEn}`, detail: `due ${dmy(due)}`, href: `/separations/${s.id}` });
  }
  add({ key: "settlement", area: "Separation", title: "Final settlements unpaid after 30 working days", law: "BLA s.30", severity: "high", items: overdue, href: "/separations" });
  const access = await prisma.employee.findMany({ where: { status: "SEPARATED", devices: { some: { removedAt: null } } } });
  add({ key: "access", area: "Separation", title: "Separated employees still enrolled on punch machines", law: "C-TPAT personnel security / access control", severity: "medium", items: access.map((e) => emp(e, `left ${dmy(e.separationDate)}`)), href: "/reports/device-delete?run=1" });
  const cases = await prisma.leftyCase.findMany({ where: { status: "OPEN" }, include: { employee: true } });
  const stalled = cases.filter((c) => (!c.letter1Date && diffDays(c.absentFrom, today) > company.leftyAbsentDays + 3) || (c.letter1Date && !c.letter2Date && diffDays(c.letter1Date, today) > 13) || (c.letter2Date && !c.letter3Date && diffDays(c.letter2Date, today) > 10));
  add({ key: "lefty", area: "Separation", title: "Lefty cases with an overdue next letter", law: "BLA s.27(3A)", severity: "low", items: stalled.map((c) => emp(c.employee, `absent since ${dmy(c.absentFrom)}`)), href: "/separations/lefty" });
  add({ key: "enrol", area: "Workforce", title: "Active employees not enrolled on any punch machine", law: "Attendance records (s.9, Form 8 / Form 34)", severity: "low", items: active.filter((e) => e.devices.length === 0).map((e) => emp(e)), href: "/reports/device-due?run=1" });

  // ── Safety teams (Rule 55(10)) ──
  const teams = await prisma.team.findMany();
  const depts = await prisma.department.findMany({ include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } } });
  const members = await prisma.employeeTeam.findMany({ where: { employee: { status: "ACTIVE" } }, select: { teamId: true, employeeId: true, employee: { select: { departmentId: true } } } });
  const gaps: CheckItem[] = [];
  for (const d of depts) {
    const head = d._count.employees;
    if (!head) continue;
    for (const t of teams) {
      const n = members.filter((m) => m.teamId === t.id && m.employee.departmentId === d.id).length;
      if ((n / head) * 100 < t.requiredPercent) gaps.push({ label: `${d.nameEn}: ${t.nameEn}`, detail: `${n} of ${head} (${round2((n / head) * 100)}% < ${t.requiredPercent}%)` });
    }
    const trained = new Set(members.filter((m) => m.employee.departmentId === d.id).map((m) => m.employeeId)).size;
    if ((trained / head) * 100 < 18) gaps.push({ label: `${d.nameEn}: trained staff`, detail: `${trained} of ${head} (< 18%)` });
  }
  add({ key: "teams", area: "Safety", title: "Fire, rescue and first-aid team coverage below minimum", law: "Labour Rules r.55(10)", severity: "medium", items: gaps, href: "/reports/safety-teams?run=1&format=coverage" });

  // ── Maternity ──
  const mat = await prisma.maternityCase.findMany({ where: { benefitEligible: true, status: { not: "CLOSED" } }, include: { employee: true } });
  add({
    key: "maternity", area: "Leave", title: "Maternity benefit instalment due but unpaid", law: "BLA s.47–48", severity: "high",
    items: mat
      .filter((m) => (!m.firstPaidOn && m.leaveFrom <= today) || (!m.secondPaidOn && m.actualDelivery && diffDays(m.actualDelivery, today) > 3))
      .map((m) => emp(m.employee, !m.firstPaidOn ? "1st instalment" : "2nd instalment")),
    href: "/maternity",
  });

  return out;
}
