// Final settlement calculation for a separation, using the employee's attendance, leave and advances.

import type { PrismaClient } from "@/generated/prisma/client";
import { addDays, monthsBetween, startOfMonth } from "../dates";
import { round2 } from "../num";
import { computePay } from "../engine/payroll";
import { computeSettlement, type SettlementResult } from "../engine/settlement";
import { processAttendance } from "./attendance";
import { leaveBalances } from "./leave";
import { payPolicy } from "./payroll";

export interface SettlementOptions {
  otherAddition?: number;
  otherDeduction?: number;
  benefitDaysOverride?: number | null;
  remarks?: string;
}

export async function outstandingAdvance(db: PrismaClient, employeeId: number): Promise<number> {
  const advances = await db.advance.findMany({ where: { employeeId }, include: { recoveries: true } });
  return round2(advances.reduce((s, a) => s + Math.max(0, a.amount - a.recoveries.reduce((x, r) => x + r.amount, 0)), 0));
}

export async function calculateSettlement(db: PrismaClient, separationId: number, opt: SettlementOptions = {}): Promise<SettlementResult> {
  const sep = await db.separation.findUniqueOrThrow({ where: { id: separationId }, include: { employee: true } });
  if (sep.settlementStatus === "PAID") throw new Error("This settlement has already been paid and cannot be recalculated.");
  const company = await db.company.findFirstOrThrow();
  const e = sep.employee;
  const last = sep.effectiveDate;
  const y = last.getUTCFullYear();
  const m = last.getUTCMonth() + 1;

  // Wages of the final month are included unless that month's payroll already covers the employee.
  const alreadyPaid = await db.payslip.findFirst({ where: { employeeId: e.id, run: { year: y, month: m } } });
  let unpaid = { days: 0, salary: 0, otHours: 0, otAmount: 0 };
  if (!alreadyPaid && last.getTime() >= e.joinDate.getTime()) {
    const mStart = startOfMonth(y, m);
    await processAttendance(db, { from: mStart, to: last, employeeIds: [e.id] });
    const leaveTypes = await db.leaveType.findMany({ select: { code: true, paid: true } });
    const paidByCode = new Map(leaveTypes.map((l) => [l.code, l.paid]));
    const days = await db.attendanceDay.findMany({ where: { employeeId: e.id, date: { gte: mStart, lte: last } } });
    const r = computePay(
      {
        year: y,
        month: m,
        emp: { ...e, separationDate: last, attendanceBonus: 0, monthlyTax: 0, paymentMode: "BANK" },
        days: days.map((d) => ({ ...d, leavePaid: d.leaveCode ? paidByCode.get(d.leaveCode) ?? true : undefined })),
      },
      payPolicy(company),
    );
    if (r) unpaid = { days: r.payableDays, salary: round2(r.earnedGross - r.absentDeduction), otHours: r.otHours, otAmount: r.otAmount };
  }

  // Unavailed earned leave (s.11) — only once the right to earned leave has accrued (one year, s.117).
  let elDays = 0;
  if (monthsBetween(e.joinDate, addDays(last, 1)) >= company.elEligibleMonths) {
    const bal = await leaveBalances(db, [e.id], y, last);
    elDays = bal.get(e.id)?.find((b) => b.accrual === "EARNED")?.balance ?? 0;
  }

  const res = computeSettlement(
    {
      type: sep.type,
      joinDate: e.joinDate,
      lastDay: last,
      permanent: e.employmentNature === "PERMANENT",
      diedOnDuty: sep.diedOnDuty,
      basic: e.basic,
      gross: e.gross,
      noticeDaysGiven: sep.noticeDaysGiven,
      elBalanceDays: elDays,
      unpaidDays: unpaid.days,
      unpaidSalary: unpaid.salary,
      unpaidOtHours: unpaid.otHours,
      unpaidOtAmount: unpaid.otAmount,
      advanceOutstanding: await outstandingAdvance(db, e.id),
      otherAddition: opt.otherAddition ?? sep.otherAddition,
      otherDeduction: opt.otherDeduction ?? sep.otherDeduction,
      benefitDaysOverride: opt.benefitDaysOverride,
    },
    { serviceBenefitBasis: company.serviceBenefitBasis, elRateBasis: company.elRateBasis },
  );

  await db.separation.update({
    where: { id: separationId },
    data: {
      settlementStatus: "CALCULATED",
      serviceText: res.serviceText,
      serviceYears: res.serviceYears,
      gross: e.gross,
      basic: e.basic,
      unpaidDays: res.unpaidDays,
      unpaidSalary: res.unpaidSalary,
      unpaidOtHours: res.unpaidOtHours,
      unpaidOtAmount: res.unpaidOtAmount,
      benefitDays: res.benefitDays,
      serviceBenefit: res.serviceBenefit,
      elDays: res.elDays,
      elAmount: res.elAmount,
      noticePayDays: res.noticePayDays,
      noticePay: res.noticePay,
      noticeDeductDays: res.noticeDeductDays,
      noticeDeduction: res.noticeDeduction,
      advanceDeduction: res.advanceDeduction,
      otherAddition: res.otherAddition,
      otherDeduction: res.otherDeduction,
      netPayable: res.netPayable,
      calculatedAt: new Date(),
      ...(opt.remarks !== undefined ? { remarks: opt.remarks } : {}),
    },
  });
  return res;
}
