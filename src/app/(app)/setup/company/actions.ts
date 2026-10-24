"use server";

import { refresh } from "next/cache";
import { FieldErrors, runAction, type FormState } from "@/lib/action";
import { audit, diff } from "@/lib/audit";
import { actionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseFields } from "@/lib/form-parse";
import { POLICY_FIELDS } from "@/lib/policy-fields";

export async function savePolicy(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("setup.manage");
    const data = parseFields(POLICY_FIELDS, fd);
    data.weeklyHoliday = Number(data.weeklyHoliday);

    // Statutory floors that the software will not let a policy go below.
    const errors: Record<string, string> = {};
    if ((data.otMultiplier as number) < 2) errors.otMultiplier = "Overtime must be paid at least twice the ordinary rate (s.108).";
    if ((data.otDivisor as number) <= 0) errors.otDivisor = "Must be greater than zero.";
    if ((data.minHiringAge as number) < 14) errors.minHiringAge = "Employing a child under 14 is prohibited (s.34).";
    if ((data.elDaysPerAccrual as number) <= 0) errors.elDaysPerAccrual = "Must be greater than zero.";
    if ((data.elDaysPerAccrual as number) > 18) errors.elDaysPerAccrual = "s.117 grants at least 1 day per 18 days worked.";
    if ((data.elEligibleMonths as number) > 12) errors.elEligibleMonths = "s.117 qualifying service is one year.";
    if ((data.wageDueWorkingDays as number) > 7) errors.wageDueWorkingDays = "s.123: wages must be paid within 7 working days.";
    if ((data.settlementDueWorkingDays as number) > 30) errors.settlementDueWorkingDays = "s.30: dues must be paid within 30 working days.";
    if (Object.keys(errors).length) throw new FieldErrors(errors);

    const company = await prisma.company.findFirstOrThrow();
    await prisma.company.update({ where: { id: company.id }, data });
    await audit(user, "UPDATE", "Company", company.id, "Updated company profile / payroll policy", diff(company, data));
    refresh();

    const warnings: string[] = [];
    if ((data.dailyOtLimit as number) > 2) warnings.push("daily OT limit above 2 h needs a government exemption");
    if ((data.weeklyHoursLimit as number) > 60) warnings.push("weekly hours above 60 breach s.102");
    if ((data.incrementPercent as number) < 5) warnings.push("RMG gazette requires a 5 % annual increment on basic");
    if ((data.elEncashMaxPercent as number) > 50) warnings.push("r.107(2) allows encashing at most half the earned-leave balance");
    if ((data.minHiringAge as number) < 18) warnings.push("most buyer codes require workers to be at least 18");
    return { ok: true, message: warnings.length ? `Saved. Note: ${warnings.join("; ")}.` : "Saved." };
  });
}
