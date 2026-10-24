// Working-time compliance checks against the Bangladesh Labour Act and buyer codes of conduct.
//  * s.100/108: normally ≤ 8 h regular + ≤ 2 h OT a day (≤ 10 h)
//  * s.102:     ≤ 48 h regular, ≤ 60 h total a week
//  * s.103:     one weekly holiday (no more than 6 consecutive working days)
//  * s.109:     women not to work 10 pm – 6 am without written consent (Rule 103, Form 35)

import { addDays, addMinutes, ymd } from "../dates";
import { round2 } from "../num";

export interface Limits {
  dailyOtLimit: number;
  dailyHoursLimit: number;
  weeklyHoursLimit: number;
  maxConsecutiveDays: number;
}

export interface HoursDay {
  date: Date;
  dayType: string;
  status: string;
  workMin: number;
  otMin?: number;
  otHours: number;
  inTime?: Date | null;
  outTime?: Date | null;
}

const worked = (d: HoursDay) => d.status === "PRESENT" || d.status === "LATE";

/**
 * Hours worked in the day: regular time from shift start plus overtime as the factory recognises it
 * (payable OT hours; raw overtime minutes for staff who are not OT-eligible). Meal break excluded.
 */
export function dayHours(d: HoursDay): number {
  const otMin = d.otMin ?? 0;
  const regular = Math.max(0, d.workMin - otMin) / 60;
  const extra = d.otHours > 0 ? d.otHours : otMin / 60;
  return round2(regular + extra);
}

export function dayFlags(d: HoursDay, l: Limits): string[] {
  if (!worked(d)) return [];
  const f: string[] = [];
  if (d.dayType === "WORKDAY" && d.otHours > l.dailyOtLimit) f.push(`OT > ${l.dailyOtLimit}h`);
  if (dayHours(d) > l.dailyHoursLimit) f.push(`Day > ${l.dailyHoursLimit}h`);
  if (d.dayType === "WEEKEND") f.push("Worked weekly holiday");
  if (d.dayType === "HOLIDAY") f.push("Worked holiday");
  return f;
}

export interface WeekBucket {
  start: Date;
  end: Date;
  hours: number;
  otHours: number;
  workedDays: number;
  overLimit: boolean;
}

/** Group days into weeks starting on `weekStartDay` (default Saturday, the usual RMG pay week). */
export function weekBuckets(days: HoursDay[], l: Limits, weekStartDay = 6): WeekBucket[] {
  const map = new Map<string, WeekBucket>();
  for (const d of days) {
    const back = (d.date.getUTCDay() - weekStartDay + 7) % 7;
    const start = addDays(d.date, -back);
    const key = ymd(start);
    let b = map.get(key);
    if (!b) {
      b = { start, end: addDays(start, 6), hours: 0, otHours: 0, workedDays: 0, overLimit: false };
      map.set(key, b);
    }
    if (worked(d)) {
      b.hours = round2(b.hours + dayHours(d));
      b.otHours = round2(b.otHours + d.otHours);
      b.workedDays++;
    }
  }
  const out = [...map.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const b of out) b.overLimit = b.hours > l.weeklyHoursLimit;
  return out;
}

/** Longest run of consecutive days worked (rest-day check). */
export function maxConsecutiveWorked(days: HoursDay[]): number {
  const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
  let best = 0, run = 0;
  let prev: Date | null = null;
  for (const d of sorted) {
    const contiguous = prev && ymd(addDays(prev, 1)) === ymd(d.date);
    if (worked(d)) run = contiguous ? run + 1 : 1;
    else run = 0;
    if (!contiguous && !worked(d)) run = 0;
    best = Math.max(best, run);
    prev = d.date;
  }
  return best;
}

/** True when the time at work overlaps 22:00–06:00. */
export function overlapsNight(d: HoursDay): boolean {
  if (!d.inTime || !d.outTime) return false;
  const nightStart = addMinutes(d.date, 22 * 60);
  const nightEnd = addMinutes(d.date, 30 * 60); // 06:00 next day
  const earlyEnd = addMinutes(d.date, 6 * 60); // 00:00–06:00 same day
  const a = d.inTime.getTime(), b = d.outTime.getTime();
  return (a < nightEnd.getTime() && b > nightStart.getTime()) || a < earlyEnd.getTime();
}

/** Consent (Form 35) is valid for 12 months unless withdrawn (Rule 103). */
export function nightConsentValid(consentDate: Date | null | undefined, withdrawn: boolean, on: Date): boolean {
  if (!consentDate || withdrawn) return false;
  const expiry = addDays(consentDate, 365);
  return on.getTime() >= consentDate.getTime() && on.getTime() < expiry.getTime();
}
