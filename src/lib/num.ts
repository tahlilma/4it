// Numeric helpers. Money is kept as JS numbers rounded to 2 decimals at each step.

/** Round half away from zero to `dp` decimals without binary-float surprises (1.005 → 1.01). */
export function round(n: number, dp = 2): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  const v = Number(Math.round(Number(`${Math.abs(n)}e${dp}`)) + `e-${dp}`);
  return sign * v;
}

export const round2 = (n: number) => round(n, 2);

/** Round to whole taka. */
export const roundTk = (n: number) => round(n, 0);

export function sum<T>(rows: T[], pick: (r: T) => number): number {
  let s = 0;
  for (const r of rows) s += pick(r) || 0;
  return round2(s);
}

const intFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Indian/Bangladeshi digit grouping: 1,23,456.00 */
export function money(n: number | null | undefined, decimals = true): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return decimals ? decFmt.format(n) : intFmt.format(n);
}

export function int(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return intFmt.format(n);
}

/** Hours with up to 2 decimals, trailing zeros trimmed: 2, 2.5, 1.25 */
export function hours(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return String(round2(n));
}

export function pct(n: number, dp = 1): string {
  return `${round(n, dp)}%`;
}

export function toNum(v: FormDataEntryValue | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export function toInt(v: FormDataEntryValue | string | null | undefined, fallback = 0): number {
  return Math.trunc(toNum(v, fallback));
}
