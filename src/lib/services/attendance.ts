// Rebuilds processed attendance (AttendanceDay) from immutable punches, approved leave and
// manual adjustments. Safe to re-run: the range is replaced atomically.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { IN_CHUNK, slices } from "../chunk";
import { addDays, eachDay, maxDate, minDate, ymd } from "../dates";
import { dayTypeFor, evaluateDay, punchWindow, shiftSpec, type ShiftSpec } from "../engine/attendance";

export interface ProcessOptions {
  from: Date;
  to: Date;
  employeeIds?: number[];
}

export async function processAttendance(db: PrismaClient, opt: ProcessOptions): Promise<{ employees: number; days: number }> {
  const { from, to } = opt;
  if (to.getTime() < from.getTime()) return { employees: 0, days: 0 };
  // Long employee lists (e.g. a device sync touching the whole factory) are processed in slices,
  // keeping every query within SQLite's limit on bound values.
  if (opt.employeeIds && opt.employeeIds.length > IN_CHUNK) {
    const total = { employees: 0, days: 0 };
    for (const slice of slices(opt.employeeIds)) {
      const r = await processAttendance(db, { ...opt, employeeIds: slice });
      total.employees += r.employees;
      total.days += r.days;
    }
    return total;
  }
  const company = await db.company.findFirstOrThrow();
  const idFilter = opt.employeeIds ? { employeeId: { in: opt.employeeIds } } : {};

  const holidays = await db.holiday.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true } });
  const holidaySet = new Set(holidays.map((h) => ymd(h.date)));

  const employees = await db.employee.findMany({
    where: {
      ...(opt.employeeIds ? { id: { in: opt.employeeIds } } : {}),
      joinDate: { lte: to },
      OR: [{ separationDate: null }, { separationDate: { gte: from } }],
    },
    select: { id: true, punchId: true, joinDate: true, separationDate: true, weeklyHoliday: true, otEligible: true, shift: true },
  });
  // Months whose payroll is locked (paid) are frozen: their attendance is never rebuilt.
  const lockedRuns = await db.payrollRun.findMany({ where: { status: "LOCKED" }, select: { year: true, month: true } });
  const locked = new Set(lockedRuns.map((r) => `${r.year}-${r.month}`));
  const isLocked = (d: Date) => locked.has(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
  const lockedRanges = lockedRuns.map((r) => ({ date: { gte: new Date(Date.UTC(r.year, r.month - 1, 1)), lte: new Date(Date.UTC(r.year, r.month, 0)) } }));

  // Rows for the whole range are replaced — this also clears days after a separation or before a
  // (corrected) joining date, which no longer belong to the employee.
  const clearWhere = { date: { gte: from, lte: to }, ...idFilter, ...(lockedRanges.length ? { NOT: lockedRanges } : {}) };
  if (!employees.length) {
    await db.attendanceDay.deleteMany({ where: clearWhere });
    return { employees: 0, days: 0 };
  }

  // Windows may start before `from` (night shifts) and end the day after `to`.
  const punches = await db.punchLog.findMany({
    where: {
      time: { gte: addDays(from, -1), lt: addDays(to, 2) },
      ...(opt.employeeIds ? { punchId: { in: employees.map((e) => e.punchId) } } : {}),
    },
    select: { punchId: true, time: true },
    orderBy: { time: "asc" },
  });
  const byPunch = new Map<number, Date[]>();
  for (const p of punches) {
    let list = byPunch.get(p.punchId);
    if (!list) byPunch.set(p.punchId, (list = []));
    list.push(p.time);
  }

  const leaves = await db.leaveApplication.findMany({
    where: { status: "APPROVED", fromDate: { lte: to }, toDate: { gte: from }, ...idFilter },
    select: { employeeId: true, fromDate: true, toDate: true, leaveType: { select: { code: true } } },
  });
  const leaveByEmp = new Map<number, typeof leaves>();
  for (const l of leaves) {
    const list = leaveByEmp.get(l.employeeId) ?? [];
    list.push(l);
    leaveByEmp.set(l.employeeId, list);
  }

  const adjusts = await db.attendanceAdjust.findMany({ where: { date: { gte: from, lte: to }, ...idFilter } });
  const adjMap = new Map(adjusts.map((a) => [`${a.employeeId}|${ymd(a.date)}`, a]));

  const specs = new Map<number, ShiftSpec>();
  const rows: Prisma.AttendanceDayCreateManyInput[] = [];

  for (const e of employees) {
    let spec = specs.get(e.shift.id);
    if (!spec) specs.set(e.shift.id, (spec = shiftSpec(e.shift)));
    const start = maxDate(from, e.joinDate);
    const end = e.separationDate ? minDate(to, e.separationDate) : to;
    const list = byPunch.get(e.punchId) ?? [];
    const weekly = e.weeklyHoliday ?? company.weeklyHoliday;
    let idx = 0;
    for (const date of eachDay(start, end)) {
      const w = punchWindow(date, spec);
      while (idx < list.length && list[idx].getTime() < w.start.getTime()) idx++;
      const dayPunches: Date[] = [];
      let j = idx;
      while (j < list.length && list[j].getTime() < w.end.getTime()) dayPunches.push(list[j++]);
      idx = j;
      if (isLocked(date)) continue;

      const leave = leaveByEmp.get(e.id)?.find((l) => l.fromDate.getTime() <= date.getTime() && l.toDate.getTime() >= date.getTime());
      const adj = adjMap.get(`${e.id}|${ymd(date)}`);
      const r = evaluateDay({
        date,
        dayType: dayTypeFor(date, weekly, holidaySet),
        punches: dayPunches,
        spec,
        leaveCode: leave?.leaveType.code ?? null,
        adjust: adj ? { status: adj.status === "ABSENT" ? "ABSENT" : "PRESENT", inTime: adj.inTime, outTime: adj.outTime } : null,
        otEligible: e.otEligible,
        holidayWorkAsOt: company.holidayWorkAsOt,
        singlePunchPresent: company.singlePunchPresent,
      });
      rows.push({ employeeId: e.id, date, shiftId: e.shift.id, ...r, remarks: adj?.reason ?? "" });
    }
  }

  await db.$transaction(
    async (tx) => {
      await tx.attendanceDay.deleteMany({ where: clearWhere });
      for (let i = 0; i < rows.length; i += 2000) {
        await tx.attendanceDay.createMany({ data: rows.slice(i, i + 2000) });
      }
    },
    { timeout: 300_000, maxWait: 20_000 },
  );
  return { employees: employees.length, days: rows.length };
}
