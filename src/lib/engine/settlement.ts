// Final settlement on separation (Bangladesh Labour Act 2006).
//
// Service benefit / compensation per completed year of service ("wages" ⇒ basic by default):
//   s.27(4)  resignation (incl. s.27(3A) deemed resignation): 5–<10 yrs 14 days, ≥10 yrs 30 days
//   s.26(4)  termination by employer:                           30 days
//   s.20     retrenchment:                                      30 days
//   s.22     discharge:                                         30 days
//   s.19     death in service (≥2 yrs; part-year > 6 months counts): 30 days, 45 if on duty / accident
//   s.28     retirement:                                        30 days
//   s.23     dismissal for misconduct:                          none (override if entitled)
// Notice: worker resigning (s.27(1)) — permanent 60 days, temporary 30 days; termination by the
// employer (s.26) — permanent 120 days, temporary 30 days; retrenchment (s.20) — 30 days.
// Unavailed earned leave is paid in full (s.11). Dues are payable within 30 working days (s.30).

import { type Span, serviceSpan, spanText } from "../dates";
import { round2, roundTk } from "../num";

export interface SeparationRule {
  benefitDaysPerYear: number;
  yearsCounted: number;
  workerNoticeDays: number; // notice the worker must give
  employerNoticeDays: number; // notice the employer must give
  note: string;
}

export function separationRule(type: string, span: Span, permanent: boolean, diedOnDuty = false): SeparationRule {
  const completed = span.years;
  switch (type) {
    case "RESIGNATION":
    case "LEFTY":
      return {
        benefitDaysPerYear: completed >= 10 ? 30 : completed >= 5 ? 14 : 0,
        yearsCounted: completed,
        workerNoticeDays: type === "RESIGNATION" ? (permanent ? 60 : 30) : 0,
        employerNoticeDays: 0,
        note: type === "LEFTY" ? "s.27(3A) deemed resignation; benefit per s.27(4)" : "s.27(4)",
      };
    case "TERMINATION":
      return { benefitDaysPerYear: permanent ? 30 : 0, yearsCounted: completed, workerNoticeDays: 0, employerNoticeDays: permanent ? 120 : 30, note: "s.26" };
    case "RETRENCHMENT":
      return { benefitDaysPerYear: completed >= 1 ? 30 : 0, yearsCounted: completed, workerNoticeDays: 0, employerNoticeDays: 30, note: "s.20" };
    case "DISCHARGE":
      return { benefitDaysPerYear: completed >= 1 ? 30 : 0, yearsCounted: completed, workerNoticeDays: 0, employerNoticeDays: 0, note: "s.22" };
    case "DEATH": {
      const years = completed + (span.months >= 6 ? 1 : 0);
      const eligible = completed >= 2;
      return {
        benefitDaysPerYear: eligible ? (diedOnDuty ? 45 : 30) : 0,
        yearsCounted: years,
        workerNoticeDays: 0,
        employerNoticeDays: 0,
        note: "s.19 — payable to nominee",
      };
    }
    case "RETIREMENT":
      return { benefitDaysPerYear: 30, yearsCounted: completed, workerNoticeDays: 0, employerNoticeDays: 0, note: "s.28" };
    case "DISMISSAL":
    default:
      return { benefitDaysPerYear: 0, yearsCounted: completed, workerNoticeDays: 0, employerNoticeDays: 0, note: "s.23" };
  }
}

export interface SettlementInput {
  type: string;
  joinDate: Date;
  lastDay: Date;
  permanent: boolean;
  diedOnDuty?: boolean;
  basic: number;
  gross: number;
  noticeDaysGiven: number;
  elBalanceDays: number;
  unpaidDays?: number;
  unpaidSalary?: number;
  unpaidOtHours?: number;
  unpaidOtAmount?: number;
  advanceOutstanding?: number;
  otherAddition?: number;
  otherDeduction?: number;
  /** Optional manual overrides (e.g. a court order or company policy above the statutory minimum). */
  benefitDaysOverride?: number | null;
}

export interface SettlementPolicy {
  serviceBenefitBasis: string; // BASIC | GROSS
  elRateBasis: string; // GROSS | BASIC
}

export interface SettlementResult {
  serviceText: string;
  serviceYears: number;
  rule: SeparationRule;
  dailyWage: number;
  benefitDays: number;
  serviceBenefit: number;
  elDays: number;
  elRate: number;
  elAmount: number;
  noticePayDays: number;
  noticePay: number;
  noticeDeductDays: number;
  noticeDeduction: number;
  unpaidDays: number;
  unpaidSalary: number;
  unpaidOtHours: number;
  unpaidOtAmount: number;
  advanceDeduction: number;
  otherAddition: number;
  otherDeduction: number;
  totalPayable: number;
  totalDeduction: number;
  netPayable: number;
}

export function computeSettlement(i: SettlementInput, p: SettlementPolicy): SettlementResult {
  const span = serviceSpan(i.joinDate, i.lastDay);
  const rule = separationRule(i.type, span, i.permanent, i.diedOnDuty);
  const wageBase = p.serviceBenefitBasis === "GROSS" ? i.gross : i.basic;
  const dailyWage = round2(wageBase / 30);

  const benefitDays =
    i.benefitDaysOverride !== null && i.benefitDaysOverride !== undefined
      ? i.benefitDaysOverride
      : rule.benefitDaysPerYear * rule.yearsCounted;
  const serviceBenefit = round2(benefitDays * dailyWage);

  const elRate = round2((p.elRateBasis === "BASIC" ? i.basic : i.gross) / 30);
  const elDays = round2(Math.max(0, i.elBalanceDays));
  const elAmount = round2(elDays * elRate);

  const noticePayDays = Math.max(0, rule.employerNoticeDays - i.noticeDaysGiven);
  const noticePay = round2(noticePayDays * dailyWage);
  const noticeDeductDays = Math.max(0, rule.workerNoticeDays - i.noticeDaysGiven);
  const noticeDeduction = round2(noticeDeductDays * dailyWage);

  const unpaidSalary = round2(i.unpaidSalary ?? 0);
  const unpaidOtAmount = round2(i.unpaidOtAmount ?? 0);
  const otherAddition = round2(i.otherAddition ?? 0);
  const advanceDeduction = round2(i.advanceOutstanding ?? 0);
  const otherDeduction = round2(i.otherDeduction ?? 0);

  const totalPayable = round2(unpaidSalary + unpaidOtAmount + serviceBenefit + elAmount + noticePay + otherAddition);
  const totalDeduction = round2(noticeDeduction + advanceDeduction + otherDeduction);
  const netPayable = roundTk(totalPayable - totalDeduction);

  return {
    serviceText: spanText(span),
    serviceYears: round2(span.years + span.months / 12 + span.days / 365),
    rule,
    dailyWage,
    benefitDays,
    serviceBenefit,
    elDays,
    elRate,
    elAmount,
    noticePayDays,
    noticePay,
    noticeDeductDays,
    noticeDeduction,
    unpaidDays: i.unpaidDays ?? 0,
    unpaidSalary,
    unpaidOtHours: i.unpaidOtHours ?? 0,
    unpaidOtAmount,
    advanceDeduction,
    otherAddition,
    otherDeduction,
    totalPayable,
    totalDeduction,
    netPayable,
  };
}
