// Festival bonus (Labour Rules 2015 r.111(5)): workers with one year of continuous service get two
// festival bonuses a year, each up to one month's basic wage. Slabs let a factory pay more generously
// to newer staff (e.g. 50 % of basic after six months).

import { monthsBetween } from "../dates";
import { roundTk } from "../num";

export interface BonusSlab {
  minMonths: number;
  percent: number;
}

export const DEFAULT_SLABS: BonusSlab[] = [
  { minMonths: 12, percent: 100 },
  { minMonths: 6, percent: 50 },
];

export function parseSlabs(json: string | null | undefined): BonusSlab[] {
  if (!json) return DEFAULT_SLABS;
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return DEFAULT_SLABS;
    return v
      .map((s) => ({ minMonths: Number(s.minMonths) || 0, percent: Number(s.percent) || 0 }))
      .filter((s) => s.percent > 0)
      .sort((a, b) => b.minMonths - a.minMonths);
  } catch {
    return DEFAULT_SLABS;
  }
}

export interface BonusEmployee {
  joinDate: Date;
  basic: number;
  gross: number;
  religion: string;
}

export interface BonusRule {
  cutoffDate: Date;
  basis: string; // BASIC | GROSS
  religions: string; // ALL or comma separated
  slabs: BonusSlab[];
}

export interface BonusCalc {
  serviceMonths: number;
  percent: number;
  amount: number;
}

/** Returns null when the festival does not apply to the employee's religion. */
export function bonusFor(e: BonusEmployee, r: BonusRule): BonusCalc | null {
  if (r.religions && r.religions !== "ALL") {
    const allowed = r.religions.split(",").map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(e.religion)) return null;
  }
  const serviceMonths = e.joinDate.getTime() > r.cutoffDate.getTime() ? 0 : monthsBetween(e.joinDate, r.cutoffDate);
  const slabs = [...r.slabs].sort((a, b) => b.minMonths - a.minMonths);
  const slab = slabs.find((s) => serviceMonths >= s.minMonths);
  const percent = slab ? slab.percent : 0;
  const base = r.basis === "GROSS" ? e.gross : e.basic;
  return { serviceMonths, percent, amount: roundTk((base * percent) / 100) };
}
