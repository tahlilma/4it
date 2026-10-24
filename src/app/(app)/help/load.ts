import { getCompany } from "@/lib/company";
import { prisma } from "@/lib/db";
import type { HelpCtx } from "./kit";

/** The factory's own settings, so the guide quotes the rules the app actually applies. */
export async function helpCtx(): Promise<HelpCtx> {
  const [company, shifts, leaveTypes] = await Promise.all([
    getCompany(),
    prisma.shift.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true, inTime: true, outTime: true, lateGraceMin: true, breakMinutes: true, otStartAfterMin: true, otRoundUnitMin: true, otRoundUpMin: true, tiffinAfter: true, nightAfter: true },
    }),
    prisma.leaveType.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true, nameEn: true, nameBn: true, annualDays: true, paid: true, accrual: true } }),
  ]);
  return { company, shifts, leaveTypes };
}
