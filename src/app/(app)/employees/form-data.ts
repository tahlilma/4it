import "server-only";
import { prisma } from "@/lib/db";
import { getCompany } from "@/lib/company";
import { orgOptions } from "@/lib/refs";
import type { EmpFormOptions, EmpPolicy, EmpValues } from "./employee-form";

export async function employeeFormOptions(): Promise<{ options: EmpFormOptions; policy: EmpPolicy }> {
  const [o, designations, grades, company] = await Promise.all([
    orgOptions(),
    prisma.designation.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] }),
    prisma.grade.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getCompany(),
  ]);
  return {
    options: {
      ...o,
      designations: designations.map((d) => ({ value: d.id, label: d.nameEn, empType: d.empType, otEligible: d.otEligible, gradeId: d.gradeId })),
      grades: grades.map((g) => ({ value: g.id, label: `${g.nameEn}${g.minGross ? ` — min ${g.minGross.toLocaleString("en-IN")}` : ""}`, minGross: g.minGross })),
    },
    policy: {
      houseRentPercent: company.houseRentPercent,
      medicalAllowance: company.medicalAllowance,
      transportAllowance: company.transportAllowance,
      foodAllowance: company.foodAllowance,
    },
  };
}

export function toFormValues(e: Record<string, unknown>): EmpValues {
  const out: EmpValues = {};
  for (const [k, v] of Object.entries(e)) {
    if (v instanceof Date) out[k] = v.toISOString().slice(0, 10);
    else if (v === null || ["string", "number", "boolean"].includes(typeof v)) out[k] = v as string | number | boolean | null;
  }
  return out;
}
