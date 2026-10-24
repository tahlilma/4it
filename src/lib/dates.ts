// Date helpers.
//
// * Calendar dates are Date objects at UTC midnight ("2026-10-22T00:00:00Z").
// * Attendance wall-clock times are "naive UTC": the factory's local time written as if it
//   were UTC. All arithmetic uses UTC getters, so results never depend on the server timezone.
// * System instants (createdAt …) are converted to local wall clock with `toLocal()` for display.

export const DAY_MS = 86_400_000;
export const MIN_MS = 60_000;

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/** Parse "YYYY-MM-DD" into a UTC-midnight date; returns null for invalid input. */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = utcDate(y, mo, d);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Parse "YYYY-MM" into { year, month }. */
export function parseMonth(s: string | null | undefined): { year: number; month: number } | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  const year = +m[1], month = +m[2];
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** "YYYY-MM-DD" */
export function ymd(d: Date | null | undefined): string {
  if (!d) return "";
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "DD/MM/YYYY" */
export function dmy(d: Date | null | undefined, sep = "/"): string {
  if (!d) return "";
  return `${pad(d.getUTCDate())}${sep}${pad(d.getUTCMonth() + 1)}${sep}${d.getUTCFullYear()}`;
}

/** "12-Sep-2021" */
export function dMonY(d: Date | null | undefined): string {
  if (!d) return "";
  return `${pad(d.getUTCDate())}-${MONTHS_SHORT[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/** "HH:MM" from a naive wall-clock time. */
export function hm(d: Date | null | undefined): string {
  if (!d) return "";
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "HH:MM:SS" */
export function hms(d: Date | null | undefined): string {
  if (!d) return "";
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** 12-hour clock: "07:55 AM" */
export function hm12(d: Date | null | undefined): string {
  if (!d) return "";
  const h = d.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${pad(d.getUTCMinutes())} ${h < 12 ? "AM" : "PM"}`;
}

/** Parse "HH:MM" into minutes after midnight. */
export function parseHm(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s || "").trim());
  if (!m) return NaN;
  const h = +m[1], mi = +m[2];
  if (h > 47 || mi > 59) return NaN;
  return h * 60 + mi;
}

export function minutesToHm(min: number): string {
  const sign = min < 0 ? "-" : "";
  const a = Math.abs(Math.round(min));
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MIN_MS);
}

/** Adds calendar months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

/** Whole days between two calendar dates (b - a). */
export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function startOfMonth(year: number, month: number): Date {
  return utcDate(year, month, 1);
}

export function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let t = dateOnly(from).getTime(); t <= to.getTime(); t += DAY_MS) out.push(new Date(t));
  return out;
}

export function sameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return !!a && !!b && ymd(a) === ymd(b);
}

export function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

export function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/** Minutes after midnight of a naive wall-clock time, relative to a base calendar date. */
export function minutesFrom(base: Date, t: Date): number {
  return Math.round((t.getTime() - base.getTime()) / MIN_MS);
}

/** Convert a real instant into the factory's naive wall clock. */
export function toLocal(instant: Date, tzOffsetMinutes = 360): Date {
  return new Date(instant.getTime() + tzOffsetMinutes * MIN_MS);
}

/** Convert a naive wall-clock time back to a real instant. */
export function fromLocal(naive: Date, tzOffsetMinutes = 360): Date {
  return new Date(naive.getTime() - tzOffsetMinutes * MIN_MS);
}

/** Today's calendar date in the factory's timezone. */
export function todayLocal(tzOffsetMinutes = 360): Date {
  return dateOnly(toLocal(new Date(), tzOffsetMinutes));
}

/** "22/10/2026 14:05" for system instants. */
export function stamp(instant: Date | null | undefined, tzOffsetMinutes = 360): string {
  if (!instant) return "";
  const l = toLocal(instant, tzOffsetMinutes);
  return `${dmy(l)} ${hm(l)}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_EN[month - 1]} ${year}`;
}

/** Completed years of age on a given date. */
export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export interface Span {
  years: number;
  months: number;
  days: number;
}

/**
 * Calendar difference from `from` up to (but excluding) `toExclusive`.
 * For service length pass the day *after* the last working day so that
 * 1 Jan – 31 Dec counts as exactly one year.
 */
export function calendarSpan(from: Date, toExclusive: Date): Span {
  if (toExclusive.getTime() <= from.getTime()) return { years: 0, months: 0, days: 0 };
  let years = toExclusive.getUTCFullYear() - from.getUTCFullYear();
  let months = toExclusive.getUTCMonth() - from.getUTCMonth();
  let days = toExclusive.getUTCDate() - from.getUTCDate();
  if (days < 0) {
    months -= 1;
    // days in the month preceding `toExclusive`
    days += new Date(Date.UTC(toExclusive.getUTCFullYear(), toExclusive.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

/** Service length from joining date through the last working day (inclusive). */
export function serviceSpan(joinDate: Date, lastDay: Date): Span {
  return calendarSpan(joinDate, addDays(lastDay, 1));
}

export function spanText(s: Span): string {
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return `${part(s.years, "year")} ${part(s.months, "month")} ${part(s.days, "day")}`;
}

export function spanMonths(s: Span): number {
  return s.years * 12 + s.months;
}

/** Whole months between two dates (calendar), never negative. */
export function monthsBetween(from: Date, to: Date): number {
  return spanMonths(calendarSpan(from, to));
}

/**
 * Add `n` working days after `date`, skipping days for which `isOff` is true.
 * Used for statutory deadlines (wages within 7 working days, dues within 30 working days).
 */
export function addWorkingDays(date: Date, n: number, isOff: (d: Date) => boolean): Date {
  let d = date;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (!isOff(d)) left--;
  }
  return d;
}
