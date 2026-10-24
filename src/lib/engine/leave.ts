// Leave entitlement rules (Bangladesh Labour Act 2006 ss.115–117, Labour Rules 2015 rr.106–107).
//
// * Casual (10 days) and sick (14 days) leave are per calendar year, not carried forward, and are
//   granted proportionately to workers who join during the year (r.106).
// * Annual / earned leave accrues one day for every 18 days actually worked (s.117) and can be
//   availed or encashed only after one year of continuous service. At most half of the balance may
//   be encashed once a year (r.107(2)); the full balance is paid on separation (s.11).

import { diffDays, utcDate } from "../dates";
import { round2 } from "../num";

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Fixed yearly entitlement, pro-rated (to whole days) for those who join during the year. */
export function fixedEntitlement(annualDays: number, year: number, joinDate: Date, proRata: boolean): number {
  const yStart = utcDate(year, 1, 1);
  const yEnd = utcDate(year, 12, 31);
  if (joinDate.getTime() > yEnd.getTime()) return 0;
  if (!proRata || joinDate.getTime() <= yStart.getTime()) return annualDays;
  const remaining = diffDays(joinDate, yEnd) + 1;
  const total = isLeapYear(year) ? 366 : 365;
  return Math.round((annualDays * remaining) / total);
}

/** Earned leave accrued for a number of days worked. */
export function elAccrued(daysWorked: number, perAccrual: number): number {
  if (perAccrual <= 0) return 0;
  return round2(daysWorked / perAccrual);
}

export interface ElBalanceInput {
  opening: number;
  daysWorked: number;
  perAccrual: number;
  availed: number;
  encashed: number;
  maxBalance: number; // 0 ⇒ no cap
}

export interface ElBalance {
  earned: number;
  availed: number;
  encashed: number;
  balance: number;
}

export function elBalance(i: ElBalanceInput): ElBalance {
  const earned = round2(i.opening + elAccrued(i.daysWorked, i.perAccrual));
  let balance = round2(earned - i.availed - i.encashed);
  if (i.maxBalance > 0 && balance > i.maxBalance) balance = i.maxBalance;
  return { earned, availed: round2(i.availed), encashed: round2(i.encashed), balance: Math.max(0, balance) };
}

/** Days that may be encashed now (r.107(2): not more than half of the balance, once a year). */
export function elEncashable(balance: number, maxPercent: number): number {
  return round2((Math.max(0, balance) * maxPercent) / 100);
}

/** Inclusive number of calendar days in a leave span. Weekly holidays inside CL/SL count as leave (r.106). */
export function leaveDays(from: Date, to: Date): number {
  return Math.max(0, diffDays(from, to) + 1);
}
