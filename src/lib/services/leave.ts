// Leave balances per employee and leave type for a calendar year.

import type { PrismaClient } from "@/generated/prisma/client";
import { inChunks } from "../chunk";
import { diffDays, maxDate, minDate, monthsBetween, utcDate } from "../dates";
import { round2 } from "../num";
import { elBalance, fixedEntitlement } from "../engine/leave";

export interface LeaveBalance {
  code: string;
  nameEn: string;
  nameBn: string;
  accrual: string;
  entitlement: number; // FIXED: yearly entitlement; EARNED: total earned to date
  availed: number;
  encashed: number;
  balance: number;
  eligible: boolean; // EARNED: completed the qualifying service
}

function overlapDays(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): number {
  const s = maxDate(aFrom, bFrom);
  const e = minDate(aTo, bTo);
  return e.getTime() < s.getTime() ? 0 : diffDays(s, e) + 1;
}

export async function leaveBalances(
  db: PrismaClient,
  employeeIds: number[] | null,
  year: number,
  asOf: Date,
): Promise<Map<number, LeaveBalance[]>> {
  const company = await db.company.findFirstOrThrow();
  const yStart = utcDate(year, 1, 1);
  const yEnd = utcDate(year, 12, 31);
  const idWhere = employeeIds ? { id: { in: employeeIds } } : { status: "ACTIVE" };
  const employees = await db.employee.findMany({
    where: idWhere,
    select: { id: true, joinDate: true, gender: true, elOpening: true, elOpeningDate: true },
  });
  const ids = employees.map((e) => e.id);
  const types = await db.leaveType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });

  const apps = await db.leaveApplication.findMany({
    where: { employeeId: { in: ids }, status: "APPROVED", fromDate: { lte: asOf } },
    select: { employeeId: true, leaveTypeId: true, fromDate: true, toDate: true, days: true },
  });
  const appsByEmp = new Map<number, typeof apps>();
  for (const a of apps) {
    const list = appsByEmp.get(a.employeeId) ?? [];
    list.push(a);
    appsByEmp.set(a.employeeId, list);
  }

  // Days actually worked (earned-leave accrual, s.117). Employees migrated with an opening balance only
  // accrue from their opening date — counted per distinct opening date (usually one migration batch).
  const countWorked = (slice: number[], after?: Date) =>
    db.attendanceDay.groupBy({
      by: ["employeeId"],
      where: { employeeId: { in: slice }, status: { in: ["PRESENT", "LATE"] }, date: after ? { gt: after, lte: asOf } : { lte: asOf } },
      _count: { _all: true },
    });
  const fromJoining = employees.filter((e) => !e.elOpeningDate).map((e) => e.id);
  const byOpening = new Map<number, number[]>();
  for (const e of employees) {
    if (!e.elOpeningDate) continue;
    const list = byOpening.get(e.elOpeningDate.getTime()) ?? [];
    list.push(e.id);
    byOpening.set(e.elOpeningDate.getTime(), list);
  }
  const workedMap = new Map<number, number>();
  for (const w of await inChunks(fromJoining, (s) => countWorked(s))) workedMap.set(w.employeeId, w._count._all);
  for (const [opening, list] of byOpening) {
    for (const w of await inChunks(list, (s) => countWorked(s, new Date(opening)))) workedMap.set(w.employeeId, w._count._all);
  }

  const enc = await inChunks(ids, (slice) =>
    db.elEncashLine.groupBy({
      by: ["employeeId"],
      where: { employeeId: { in: slice }, run: { status: "POSTED", asOfDate: { lte: asOf } } },
      _sum: { encashDays: true },
    }),
  );
  const encMap = new Map(enc.map((x) => [x.employeeId, x._sum.encashDays ?? 0]));

  const out = new Map<number, LeaveBalance[]>();
  for (const e of employees) {
    const list: LeaveBalance[] = [];
    const myApps = appsByEmp.get(e.id) ?? [];
    for (const t of types) {
      if (t.gender && t.gender !== e.gender) continue;
      const tApps = myApps.filter((a) => a.leaveTypeId === t.id);
      if (t.accrual === "EARNED") {
        const since = e.elOpeningDate ?? e.joinDate;
        const availed = round2(
          tApps.reduce((s, a) => {
            const span = diffDays(a.fromDate, a.toDate) + 1;
            const inRange = overlapDays(a.fromDate, a.toDate, since, asOf);
            return s + (inRange === span ? a.days : inRange);
          }, 0),
        );
        const b = elBalance({
          opening: e.elOpening,
          daysWorked: workedMap.get(e.id) ?? 0,
          perAccrual: company.elDaysPerAccrual,
          availed,
          encashed: encMap.get(e.id) ?? 0,
          maxBalance: company.elMaxBalance,
        });
        list.push({
          code: t.code, nameEn: t.nameEn, nameBn: t.nameBn, accrual: t.accrual,
          entitlement: b.earned, availed: b.availed, encashed: b.encashed, balance: b.balance,
          eligible: monthsBetween(e.joinDate, asOf) >= company.elEligibleMonths,
        });
      } else {
        const availed = round2(
          tApps.reduce((s, a) => {
            const span = diffDays(a.fromDate, a.toDate) + 1;
            const inYear = overlapDays(a.fromDate, a.toDate, yStart, yEnd);
            return s + (inYear === span ? a.days : inYear);
          }, 0),
        );
        const entitlement = t.accrual === "FIXED" ? fixedEntitlement(t.annualDays, year, e.joinDate, t.proRata) : 0;
        list.push({
          code: t.code, nameEn: t.nameEn, nameBn: t.nameBn, accrual: t.accrual,
          entitlement, availed, encashed: 0,
          balance: t.accrual === "FIXED" ? round2(Math.max(0, entitlement - availed)) : 0,
          eligible: true,
        });
      }
    }
    out.set(e.id, list);
  }
  return out;
}
