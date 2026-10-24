// Monthly wage computation for one employee. Pure — the caller supplies processed attendance.
//
// earned gross   = gross × (employed days − unpaid leave days) ÷ days in month
// absent deduct  = absent days × (basic | gross) ÷ (30 | days in month)
// overtime       = OT hours × (basic × 2 ÷ 208)
// gross payable  = earned − absent deduction + OT + attendance bonus + holiday allowance + arrears/additions
// net            = gross payable − (advance + stamp + tax + other deductions), rounded to whole taka

import { daysInMonth, diffDays, endOfMonth, maxDate, minDate, startOfMonth } from "../dates";
import { round2, roundTk } from "../num";
import { otRate } from "./salary";

export interface PayPolicy {
  absentBasis: string; // BASIC | GROSS
  absentDivisor: string; // 30 | MONTH_DAYS
  otDivisor: number;
  otMultiplier: number;
  dailyOtLimit: number;
  dailyHoursLimit: number;
  stampCash: number;
  stampBank: number;
  attBonusMaxLate: number;
  attBonusAllowLeave: boolean;
  holidayAllowBasis: string; // GROSS | BASIC | NONE
}

export interface PayEmployee {
  gross: number;
  basic: number;
  houseRent: number;
  medical: number;
  transport: number;
  food: number;
  otherAllowance: number;
  joinDate: Date;
  separationDate?: Date | null;
  otEligible: boolean;
  paymentMode: string;
  monthlyTax: number;
  attendanceBonus: number;
}

export interface PayDay {
  date: Date;
  dayType: string;
  status: string;
  leaveCode?: string | null;
  leavePaid?: boolean;
  otHours: number;
}

export interface PayInput {
  year: number;
  month: number;
  emp: PayEmployee;
  days: PayDay[];
  arrear?: number;
  otherAddition?: number;
  otherDeduction?: number;
  advanceDeduction?: number;
}

export interface PayResult {
  category: "REGULAR" | "NEW_JOIN" | "SEPARATED" | "NEW_AND_SEPARATED";
  monthDays: number;
  employedDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weekendDays: number;
  holidayDays: number;
  holidayWorkDays: number;
  missingDays: number;
  payableDays: number;
  earnedGross: number;
  absentDeduction: number;
  otHours: number;
  otHoursNormal: number;
  otHoursExcess: number;
  otRate: number;
  otAmount: number;
  attendanceBonus: number;
  holidayAllowance: number;
  arrear: number;
  otherAddition: number;
  grossPayable: number;
  advanceDeduction: number;
  stamp: number;
  tax: number;
  otherDeduction: number;
  totalDeduction: number;
  netPayable: number;
}

/** Returns null when the employee was not employed at any time during the month. */
export function computePay(inp: PayInput, policy: PayPolicy): PayResult | null {
  const { year, month, emp } = inp;
  const monthDays = daysInMonth(year, month);
  const mStart = startOfMonth(year, month);
  const mEnd = endOfMonth(year, month);
  const from = maxDate(mStart, emp.joinDate);
  const to = emp.separationDate ? minDate(mEnd, emp.separationDate) : mEnd;
  if (from.getTime() > to.getTime()) return null;

  const employedDays = diffDays(from, to) + 1;
  const joinedThisMonth = emp.joinDate.getTime() > mStart.getTime();
  const leftThisMonth = !!emp.separationDate && emp.separationDate.getTime() < mEnd.getTime();
  const category = joinedThisMonth && leftThisMonth ? "NEW_AND_SEPARATED" : joinedThisMonth ? "NEW_JOIN" : leftThisMonth ? "SEPARATED" : "REGULAR";

  let presentDays = 0, lateDays = 0, absentDays = 0, paidLeaveDays = 0, unpaidLeaveDays = 0;
  let weekendDays = 0, holidayDays = 0, holidayWorkDays = 0, seen = 0;
  let otHours = 0, otNormal = 0, otExcess = 0;

  for (const d of inp.days) {
    const t = d.date.getTime();
    if (t < from.getTime() || t > to.getTime()) continue;
    seen++;
    if (d.dayType === "WEEKEND") weekendDays++;
    if (d.dayType === "HOLIDAY") holidayDays++;
    const present = d.status === "PRESENT" || d.status === "LATE";
    if (present) {
      presentDays++;
      if (d.status === "LATE") lateDays++;
      if (d.dayType !== "WORKDAY") holidayWorkDays++;
    } else if (d.status === "ABSENT") {
      absentDays++;
    } else if (d.status === "LEAVE") {
      if (d.leavePaid === false) unpaidLeaveDays++;
      else paidLeaveDays++;
    }
    if (emp.otEligible && d.otHours > 0) {
      otHours += d.otHours;
      // Statutory daily ceiling: 2 h OT on a working day; on a holiday all hours are OT, capped by the 10 h day.
      const cap = d.dayType === "WORKDAY" ? policy.dailyOtLimit : policy.dailyHoursLimit;
      const normal = Math.min(d.otHours, cap);
      otNormal += normal;
      otExcess += d.otHours - normal;
    }
  }
  const missingDays = Math.max(0, employedDays - seen);

  const paidCalendarDays = employedDays - unpaidLeaveDays;
  const earnedGross = paidCalendarDays >= monthDays ? round2(emp.gross) : round2((emp.gross * paidCalendarDays) / monthDays);

  const absentBase = policy.absentBasis === "GROSS" ? emp.gross : emp.basic;
  const absentDiv = policy.absentDivisor === "MONTH_DAYS" ? monthDays : 30;
  const absentDeduction = Math.min(earnedGross, round2((absentDays * absentBase) / absentDiv));

  const rate = emp.otEligible ? otRate(emp.basic, policy) : 0;
  otHours = round2(otHours);
  const otAmount = round2(otHours * rate);

  const fullMonth = employedDays === monthDays;
  const anyLeave = paidLeaveDays + unpaidLeaveDays > 0;
  const bonusOk =
    emp.attendanceBonus > 0 &&
    fullMonth &&
    absentDays === 0 &&
    missingDays === 0 &&
    lateDays <= policy.attBonusMaxLate &&
    (policy.attBonusAllowLeave || !anyLeave);
  const attendanceBonus = bonusOk ? round2(emp.attendanceBonus) : 0;

  let holidayAllowance = 0;
  if (!emp.otEligible && holidayWorkDays > 0 && policy.holidayAllowBasis !== "NONE") {
    const base = policy.holidayAllowBasis === "BASIC" ? emp.basic : emp.gross;
    holidayAllowance = round2(holidayWorkDays * round2(base / 30));
  }

  const arrear = round2(inp.arrear ?? 0);
  const otherAddition = round2(inp.otherAddition ?? 0);
  const grossPayable = round2(earnedGross - absentDeduction + otAmount + attendanceBonus + holidayAllowance + arrear + otherAddition);

  const stamp = grossPayable > 0 ? (emp.paymentMode === "CASH" ? policy.stampCash : policy.stampBank) : 0;
  const tax = round2(emp.monthlyTax || 0);
  const advanceDeduction = round2(inp.advanceDeduction ?? 0);
  const otherDeduction = round2(inp.otherDeduction ?? 0);
  const totalDeduction = round2(advanceDeduction + stamp + tax + otherDeduction);
  const netPayable = Math.max(0, roundTk(grossPayable - totalDeduction));

  return {
    category,
    monthDays,
    employedDays,
    presentDays,
    lateDays,
    absentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    weekendDays,
    holidayDays,
    holidayWorkDays,
    missingDays,
    payableDays: paidCalendarDays - absentDays,
    earnedGross,
    absentDeduction,
    otHours,
    otHoursNormal: round2(otNormal),
    otHoursExcess: round2(otExcess),
    otRate: rate,
    otAmount,
    attendanceBonus,
    holidayAllowance,
    arrear,
    otherAddition,
    grossPayable,
    advanceDeduction,
    stamp,
    tax,
    otherDeduction,
    totalDeduction,
    netPayable,
  };
}
