// Daily attendance evaluation: turns raw punches into status, late / early-out minutes,
// working minutes, overtime and tiffin / night bill eligibility. Pure — no database access.

import { addMinutes, minutesFrom, parseHm, ymd } from "../dates";
import { round2 } from "../num";

export type DayType = "WORKDAY" | "WEEKEND" | "HOLIDAY";
export type DayStatus = "PRESENT" | "LATE" | "ABSENT" | "LEAVE" | "OFF";

export interface ShiftLike {
  inTime: string;
  outTime: string;
  lateGraceMin: number;
  earlyGraceMin: number;
  breakMinutes: number;
  otStartAfterMin: number;
  otRoundUnitMin: number;
  otRoundUpMin: number;
  tiffinAfter: string;
  nightAfter: string;
  windowBeforeMin: number;
}

/** Shift with all times expressed as minutes from the attendance date's midnight. */
export interface ShiftSpec {
  inMin: number;
  outMin: number;
  lateGraceMin: number;
  earlyGraceMin: number;
  breakMinutes: number;
  otStartAfterMin: number;
  otRoundUnitMin: number;
  otRoundUpMin: number;
  tiffinAfterMin: number;
  nightAfterMin: number;
  windowBeforeMin: number;
}

export function shiftSpec(s: ShiftLike): ShiftSpec {
  const inMin = parseHm(s.inTime);
  let outMin = parseHm(s.outTime);
  if (outMin <= inMin) outMin += 1440; // night shift ends next day
  const later = (t: string) => {
    let m = parseHm(t);
    if (Number.isNaN(m)) return Number.POSITIVE_INFINITY;
    if (m < inMin) m += 1440; // e.g. night bill "03:00" means next morning
    return m;
  };
  return {
    inMin,
    outMin,
    lateGraceMin: s.lateGraceMin,
    earlyGraceMin: s.earlyGraceMin,
    breakMinutes: s.breakMinutes,
    otStartAfterMin: s.otStartAfterMin,
    otRoundUnitMin: Math.max(1, s.otRoundUnitMin),
    otRoundUpMin: s.otRoundUpMin,
    tiffinAfterMin: later(s.tiffinAfter),
    nightAfterMin: later(s.nightAfter),
    windowBeforeMin: s.windowBeforeMin,
  };
}

/** Punches in [start, end) belong to this attendance date. The window is 24 h long. */
export function punchWindow(date: Date, spec: ShiftSpec): { start: Date; end: Date } {
  const start = addMinutes(date, spec.inMin - spec.windowBeforeMin);
  return { start, end: addMinutes(start, 1440) };
}

/** Round overtime minutes into payable hours: whole units, plus one if the remainder reaches the threshold. */
export function roundOt(minutes: number, unitMin: number, roundUpMin: number): number {
  if (minutes <= 0) return 0;
  const unit = Math.max(1, unitMin);
  const units = Math.floor(minutes / unit);
  const rem = minutes - units * unit;
  const total = units + (rem >= roundUpMin ? 1 : 0);
  return round2((total * unit) / 60);
}

export function dayTypeFor(date: Date, weeklyHoliday: number, holidays: Set<string>): DayType {
  if (holidays.has(ymd(date))) return "HOLIDAY";
  if (date.getUTCDay() === weeklyHoliday) return "WEEKEND";
  return "WORKDAY";
}

export interface DayAdjust {
  status: "PRESENT" | "ABSENT";
  inTime?: Date | null;
  outTime?: Date | null;
}

export interface DayInput {
  date: Date;
  dayType: DayType;
  punches: Date[];
  spec: ShiftSpec;
  leaveCode?: string | null;
  adjust?: DayAdjust | null;
  otEligible: boolean;
  holidayWorkAsOt: boolean;
  singlePunchPresent: boolean;
  /** Punches closer together than this are treated as one swipe. */
  duplicateMin?: number;
}

export interface DayResult {
  dayType: DayType;
  status: DayStatus;
  leaveCode: string | null;
  inTime: Date | null;
  outTime: Date | null;
  punchCount: number;
  singlePunch: boolean;
  lateMin: number;
  earlyOutMin: number;
  workMin: number;
  otMin: number;
  otHours: number;
  tiffin: boolean;
  nightBill: boolean;
  adjusted: boolean;
}

const BREAK_AFTER_MIN = 5 * 60; // break is deducted once the span covers more than 5 hours

export function evaluateDay(inp: DayInput): DayResult {
  const { date, dayType, spec } = inp;
  const dup = inp.duplicateMin ?? 10;
  const sorted = [...inp.punches].sort((a, b) => a.getTime() - b.getTime());

  const res: DayResult = {
    dayType,
    status: dayType === "WORKDAY" ? "ABSENT" : "OFF",
    leaveCode: null,
    inTime: null,
    outTime: null,
    punchCount: sorted.length,
    singlePunch: false,
    lateMin: 0,
    earlyOutMin: 0,
    workMin: 0,
    otMin: 0,
    otHours: 0,
    tiffin: false,
    nightBill: false,
    adjusted: !!inp.adjust,
  };

  // Resolve in / out from punches.
  if (sorted.length > 0) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (sorted.length >= 2 && minutesFrom(first, last) >= dup) {
      res.inTime = first;
      res.outTime = last;
    } else {
      res.singlePunch = true;
      const mid = spec.inMin + (spec.outMin - spec.inMin) / 2;
      if (minutesFrom(date, first) <= mid) res.inTime = first;
      else res.outTime = first;
    }
  }

  // Manual adjustment overrides punches where it supplies times.
  if (inp.adjust) {
    if (inp.adjust.inTime) res.inTime = inp.adjust.inTime;
    if (inp.adjust.outTime) res.outTime = inp.adjust.outTime;
    if (res.inTime && res.outTime) res.singlePunch = false;
  }

  // Approved leave has priority.
  if (inp.leaveCode) {
    res.status = "LEAVE";
    res.leaveCode = inp.leaveCode;
    return res;
  }

  if (inp.adjust?.status === "ABSENT") {
    res.status = dayType === "WORKDAY" ? "ABSENT" : "OFF";
    return res;
  }

  const manualPresent = inp.adjust?.status === "PRESENT";
  const hasTimes = !!(res.inTime || res.outTime);

  if (!hasTimes && !manualPresent) return res; // absent on a working day, off otherwise

  if (res.singlePunch && !inp.singlePunchPresent && !manualPresent) return res;

  // Late arrival / early departure only apply to working days.
  if (dayType === "WORKDAY" && res.inTime) {
    const m = minutesFrom(date, res.inTime);
    if (m > spec.inMin + spec.lateGraceMin) res.lateMin = m - spec.inMin;
  }
  if (dayType === "WORKDAY" && res.outTime && res.inTime) {
    const m = minutesFrom(date, res.outTime);
    if (m < spec.outMin - spec.earlyGraceMin) res.earlyOutMin = spec.outMin - m;
  }

  if (res.inTime && res.outTime) {
    // Work is counted from the shift start: arriving early is not working time.
    const shiftStart = addMinutes(date, spec.inMin);
    const from = res.inTime.getTime() < shiftStart.getTime() ? shiftStart : res.inTime;
    let span = Math.max(0, minutesFrom(from, res.outTime));
    if (span > BREAK_AFTER_MIN) span -= spec.breakMinutes;
    res.workMin = Math.max(0, span);

    if (dayType === "WORKDAY") {
      const outM = minutesFrom(date, res.outTime);
      const otFrom = spec.outMin + spec.otStartAfterMin;
      if (outM > otFrom) res.otMin = outM - otFrom;
    } else if (inp.holidayWorkAsOt) {
      res.otMin = res.workMin; // every hour on a weekly / festival holiday is overtime
    }

    const outM = minutesFrom(date, res.outTime);
    res.tiffin = outM >= spec.tiffinAfterMin;
    res.nightBill = outM >= spec.nightAfterMin;
  }

  res.otHours = inp.otEligible ? roundOt(res.otMin, spec.otRoundUnitMin, spec.otRoundUpMin) : 0;
  res.status = dayType === "WORKDAY" && res.lateMin > 0 ? "LATE" : "PRESENT";
  return res;
}

export function isPresent(status: string): boolean {
  return status === "PRESENT" || status === "LATE";
}

/** Short code used in registers and job cards. */
export function statusCode(d: { status: string; dayType: string; leaveCode?: string | null }): string {
  if (d.status === "LEAVE") return d.leaveCode || "LV";
  if (d.status === "ABSENT") return "A";
  if (d.status === "OFF") return d.dayType === "WEEKEND" ? "W" : "H";
  if (d.dayType !== "WORKDAY") return d.dayType === "WEEKEND" ? "WP" : "HP";
  return d.status === "LATE" ? "L" : "P";
}
