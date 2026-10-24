// Monthly payroll processing: re-processes the month's attendance, computes every payslip, applies
// advance instalments and stores an immutable snapshot (org unit, salary structure) per employee.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { endOfMonth, monthLabel, startOfMonth, todayLocal } from "../dates";
import { round2 } from "../num";
import { computePay, type PayDay, type PayPolicy } from "../engine/payroll";
import { processAttendance } from "./attendance";

export function payPolicy(c: {
  absentBasis: string; absentDivisor: string; otDivisor: number; otMultiplier: number; dailyOtLimit: number;
  dailyHoursLimit: number; stampCash: number; stampBank: number; attBonusMaxLate: number; attBonusAllowLeave: boolean;
  holidayAllowBasis: string;
}): PayPolicy {
  return {
    absentBasis: c.absentBasis,
    absentDivisor: c.absentDivisor,
    otDivisor: c.otDivisor,
    otMultiplier: c.otMultiplier,
    dailyOtLimit: c.dailyOtLimit,
    dailyHoursLimit: c.dailyHoursLimit,
    stampCash: c.stampCash,
    stampBank: c.stampBank,
    attBonusMaxLate: c.attBonusMaxLate,
    attBonusAllowLeave: c.attBonusAllowLeave,
    holidayAllowBasis: c.holidayAllowBasis,
  };
}

/** Remaining balance of an advance, ignoring this month's payroll recovery (which is being recomputed). */
function advanceInstallment(
  a: { amount: number; installments: number; startYear: number; startMonth: number; recoveries: { year: number; month: number; source: string; amount: number }[] },
  year: number,
  month: number,
): number {
  if (year * 12 + month < a.startYear * 12 + a.startMonth) return 0;
  const recovered = a.recoveries
    .filter((r) => !(r.year === year && r.month === month && r.source === "PAYROLL"))
    .reduce((s, r) => s + r.amount, 0);
  const remaining = round2(a.amount - recovered);
  if (remaining <= 0) return 0;
  const inst = round2(a.amount / Math.max(1, a.installments));
  return Math.min(inst, remaining);
}

export async function processPayroll(db: PrismaClient, runId: number, userName: string): Promise<{ count: number; warnings: string[] }> {
  const run = await db.payrollRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === "LOCKED") throw new Error("This payroll is locked. Unlock it before re-processing.");
  const company = await db.company.findFirstOrThrow();
  const { year, month } = run;
  const mStart = startOfMonth(year, month);
  const mEnd = endOfMonth(year, month);
  if (mEnd.getTime() >= todayLocal(company.tzOffsetMinutes).getTime()) {
    throw new Error(`${monthLabel(year, month)} has not ended yet. Payroll can be processed after the last day of the month.`);
  }

  await processAttendance(db, { from: mStart, to: mEnd });

  const employees = await db.employee.findMany({
    where: { joinDate: { lte: mEnd }, OR: [{ separationDate: null }, { separationDate: { gte: mStart } }] },
    include: { designation: { select: { attendanceBonus: true } }, separation: { select: { type: true } } },
  });
  const leaveTypes = await db.leaveType.findMany({ select: { code: true, paid: true } });
  const paidByCode = new Map(leaveTypes.map((l) => [l.code, l.paid]));

  const days = await db.attendanceDay.findMany({
    where: { date: { gte: mStart, lte: mEnd } },
    select: { employeeId: true, date: true, dayType: true, status: true, leaveCode: true, otHours: true },
  });
  const daysByEmp = new Map<number, PayDay[]>();
  for (const d of days) {
    const list = daysByEmp.get(d.employeeId) ?? [];
    list.push({ ...d, leavePaid: d.leaveCode ? paidByCode.get(d.leaveCode) ?? true : undefined });
    daysByEmp.set(d.employeeId, list);
  }

  const adjustments = await db.payAdjustment.findMany({ where: { year, month } });
  const adj = new Map<number, { arrear: number; add: number; ded: number }>();
  for (const a of adjustments) {
    const x = adj.get(a.employeeId) ?? { arrear: 0, add: 0, ded: 0 };
    if (a.kind === "ARREAR") x.arrear += a.amount;
    else if (a.kind === "ADDITION") x.add += a.amount;
    else x.ded += a.amount;
    adj.set(a.employeeId, x);
  }

  const advances = await db.advance.findMany({ where: { OR: [{ status: "ACTIVE" }, { recoveries: { some: { year, month, source: "PAYROLL" } } }] }, include: { recoveries: true } });
  const recoveries: { advanceId: number; employeeId: number; amount: number }[] = [];
  const advByEmp = new Map<number, number>();
  for (const a of advances) {
    const inst = advanceInstallment(a, year, month);
    if (inst > 0) {
      recoveries.push({ advanceId: a.id, employeeId: a.employeeId, amount: inst });
      advByEmp.set(a.employeeId, round2((advByEmp.get(a.employeeId) ?? 0) + inst));
    }
  }

  const policy = payPolicy(company);
  const warnings: string[] = [];
  const rows: Prisma.PayslipCreateManyInput[] = [];
  const included = new Set<number>();

  for (const e of employees) {
    const a = adj.get(e.id);
    const r = computePay(
      {
        year,
        month,
        emp: {
          gross: e.gross, basic: e.basic, houseRent: e.houseRent, medical: e.medical, transport: e.transport, food: e.food,
          otherAllowance: e.otherAllowance, joinDate: e.joinDate, separationDate: e.separationDate, otEligible: e.otEligible,
          paymentMode: e.paymentMode, monthlyTax: e.monthlyTax, attendanceBonus: e.designation.attendanceBonus,
        },
        days: daysByEmp.get(e.id) ?? [],
        arrear: a?.arrear,
        otherAddition: a?.add,
        otherDeduction: a?.ded,
        advanceDeduction: advByEmp.get(e.id) ?? 0,
      },
      policy,
    );
    if (!r) continue;
    if (r.missingDays > 0) warnings.push(`${e.empCode}: ${r.missingDays} day(s) without processed attendance`);
    included.add(e.id);
    const { missingDays: _m, ...pay } = r;
    void _m;
    rows.push({
      runId,
      employeeId: e.id,
      departmentId: e.departmentId,
      sectionId: e.sectionId,
      designationId: e.designationId,
      gradeId: e.gradeId,
      lineId: e.lineId,
      empType: e.empType,
      paymentMode: e.paymentMode,
      separationType: e.separation?.type ?? null,
      gross: e.gross,
      basic: e.basic,
      houseRent: e.houseRent,
      medical: e.medical,
      transport: e.transport,
      food: e.food,
      otherAllowance: e.otherAllowance,
      ...pay,
    });
  }

  await db.$transaction(
    async (tx) => {
      await tx.payslip.deleteMany({ where: { runId } });
      await tx.advanceRecovery.deleteMany({ where: { year, month, source: "PAYROLL" } });
      for (let i = 0; i < rows.length; i += 1000) await tx.payslip.createMany({ data: rows.slice(i, i + 1000) });
      for (const rec of recoveries) {
        if (!included.has(rec.employeeId)) continue;
        await tx.advanceRecovery.create({ data: { advanceId: rec.advanceId, year, month, amount: rec.amount, source: "PAYROLL" } });
      }
      // Close fully-recovered advances (and re-open ones that a re-process no longer fully recovers).
      for (const a of advances) {
        const total = await tx.advanceRecovery.aggregate({ where: { advanceId: a.id }, _sum: { amount: true } });
        const status = round2(total._sum.amount ?? 0) >= round2(a.amount) ? "CLOSED" : "ACTIVE";
        if (status !== a.status) await tx.advance.update({ where: { id: a.id }, data: { status } });
      }
      await tx.payrollRun.update({ where: { id: runId }, data: { status: "PROCESSED", processedAt: new Date(), processedBy: userName } });
    },
    { timeout: 300_000, maxWait: 20_000 },
  );
  return { count: rows.length, warnings };
}
