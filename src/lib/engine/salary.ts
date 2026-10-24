// Salary structure in the RMG minimum-wage gazette pattern:
//   gross = basic + house rent (50 % of basic) + medical + transport + food
// e.g. 2023 gazette entry grade: 6,700 + 3,350 + 750 + 450 + 1,250 = 12,500.

import { round2 } from "../num";

export interface StructurePolicy {
  houseRentPercent: number;
  medicalAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
}

export interface SalaryParts {
  gross: number;
  basic: number;
  houseRent: number;
  medical: number;
  transport: number;
  food: number;
  otherAllowance: number;
}

export interface FixedOverrides {
  medical?: number;
  transport?: number;
  food?: number;
}

/** Split a gross amount into basic + house rent + fixed allowances. House rent absorbs rounding. */
export function structureFromGross(gross: number, p: StructurePolicy, o: FixedOverrides = {}): SalaryParts {
  const medical = o.medical ?? p.medicalAllowance;
  const transport = o.transport ?? p.transportAllowance;
  const food = o.food ?? p.foodAllowance;
  const fixed = medical + transport + food;
  const factor = 1 + p.houseRentPercent / 100;
  const basic = Math.max(0, round2((gross - fixed) / factor));
  const houseRent = Math.max(0, round2(gross - fixed - basic));
  return { gross: round2(gross), basic, houseRent, medical, transport, food, otherAllowance: 0 };
}

/** Build the full structure from a basic amount. */
export function structureFromBasic(basic: number, p: StructurePolicy, o: FixedOverrides = {}): SalaryParts {
  const medical = o.medical ?? p.medicalAllowance;
  const transport = o.transport ?? p.transportAllowance;
  const food = o.food ?? p.foodAllowance;
  const b = round2(basic);
  const houseRent = round2((b * p.houseRentPercent) / 100);
  return {
    gross: round2(b + houseRent + medical + transport + food),
    basic: b,
    houseRent,
    medical,
    transport,
    food,
    otherAllowance: 0,
  };
}

export function totalOf(p: Omit<SalaryParts, "gross">): number {
  return round2(p.basic + p.houseRent + p.medical + p.transport + p.food + (p.otherAllowance || 0));
}

/** Hourly overtime rate: basic × 2 / 208 (BLA s.108, Labour Rules r.102). */
export function otRate(basic: number, p: { otDivisor: number; otMultiplier: number }): number {
  if (!p.otDivisor) return 0;
  return round2((basic * p.otMultiplier) / p.otDivisor);
}

/**
 * Annual increment on basic (RMG gazette: 5 % of basic every year). House rent follows basic;
 * medical, transport and food stay as they are.
 */
export function incrementOnBasic(cur: SalaryParts, percent: number, p: StructurePolicy): SalaryParts {
  const basic = round2(cur.basic * (1 + percent / 100));
  const houseRent = round2((basic * p.houseRentPercent) / 100);
  const gross = round2(basic + houseRent + cur.medical + cur.transport + cur.food + (cur.otherAllowance || 0));
  return { ...cur, basic, houseRent, gross };
}
