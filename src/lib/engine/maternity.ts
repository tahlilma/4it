// Maternity benefit (Bangladesh Labour Act 2006 ss.45–50).
//  * 8 weeks before and 8 weeks after delivery = 112 days.
//  * Eligible for the cash benefit after 6 months' service before the delivery date, and only if she
//    has fewer than two surviving children (the leave itself is still due otherwise).
//  * Rate = average daily wage: wages of the 3 months before notice ÷ days actually worked (s.48).
//  * Paid in two equal instalments (before and after delivery).

import { addDays, monthsBetween } from "../dates";
import { round2 } from "../num";

export const MATERNITY_DAYS = 112;

export interface MaternityInput {
  joinDate: Date;
  expectedDelivery: Date;
  survivingChildren: number;
  wages3m: number;
  daysWorked3m: number;
}

export interface MaternityCalc {
  serviceMonths: number;
  benefitEligible: boolean;
  reason: string;
  leaveFrom: Date;
  leaveTo: Date;
  avgDailyWage: number;
  totalBenefit: number;
  firstInstallment: number;
  secondInstallment: number;
}

export function computeMaternity(i: MaternityInput): MaternityCalc {
  const serviceMonths = monthsBetween(i.joinDate, i.expectedDelivery);
  const serviceOk = serviceMonths >= 6;
  const childrenOk = i.survivingChildren < 2;
  const benefitEligible = serviceOk && childrenOk;
  const reason = benefitEligible
    ? "Eligible (s.46)"
    : !serviceOk
      ? "Less than 6 months' service before delivery — leave only, no cash benefit (s.46(1))"
      : "Two or more surviving children — leave only, no cash benefit (s.46(3))";
  const avgDailyWage = i.daysWorked3m > 0 ? round2(i.wages3m / i.daysWorked3m) : 0;
  const totalBenefit = benefitEligible ? round2(avgDailyWage * MATERNITY_DAYS) : 0;
  const firstInstallment = round2(totalBenefit / 2);
  return {
    serviceMonths,
    benefitEligible,
    reason,
    leaveFrom: addDays(i.expectedDelivery, -56),
    leaveTo: addDays(i.expectedDelivery, MATERNITY_DAYS - 57),
    avgDailyWage,
    totalBenefit,
    firstInstallment,
    secondInstallment: round2(totalBenefit - firstInstallment),
  };
}
