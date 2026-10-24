// Annual increments and promotions: proposals → approval → application to the employee record.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { inChunks } from "../chunk";
import { addMonths } from "../dates";
import { round2 } from "../num";
import { incrementOnBasic, structureFromGross, type SalaryParts } from "../engine/salary";

/** Date of the last increment/promotion, or the joining date. */
export async function lastIncrementDates(db: PrismaClient, employeeIds: number[]): Promise<Map<number, Date>> {
  const hist = await inChunks(employeeIds, (slice) =>
    db.salaryHistory.groupBy({
      by: ["employeeId"],
      where: { employeeId: { in: slice }, type: { in: ["INCREMENT", "PROMOTION"] } },
      _max: { effectiveDate: true },
    }),
  );
  return new Map(hist.filter((h) => h._max.effectiveDate).map((h) => [h.employeeId, h._max.effectiveDate as Date]));
}

export interface ProposalOptions {
  effectiveDate: Date;
  percent: number;
  employeeIds?: number[];
  onlyDue?: boolean;
}

export async function generateIncrementProposals(db: PrismaClient, opt: ProposalOptions): Promise<number> {
  const company = await db.company.findFirstOrThrow();
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE", joinDate: { lte: opt.effectiveDate }, ...(opt.employeeIds ? { id: { in: opt.employeeIds } } : {}) },
  });
  const ids = employees.map((e) => e.id);
  const last = await lastIncrementDates(db, ids);
  const open = await db.increment.findMany({ where: { employeeId: { in: ids }, status: { in: ["PROPOSED", "APPROVED"] } }, select: { employeeId: true } });
  const pending = new Set(open.map((o) => o.employeeId));

  const rows: Prisma.IncrementCreateManyInput[] = [];
  for (const e of employees) {
    if (pending.has(e.id)) continue;
    const since = last.get(e.id) ?? e.joinDate;
    if ((opt.onlyDue ?? true) && addMonths(since, 12).getTime() > opt.effectiveDate.getTime()) continue;
    const cur: SalaryParts = { gross: e.gross, basic: e.basic, houseRent: e.houseRent, medical: e.medical, transport: e.transport, food: e.food, otherAllowance: e.otherAllowance };
    const next =
      e.empType === "WORKER"
        ? incrementOnBasic(cur, opt.percent, company)
        : structureFromGross(round2(e.gross * (1 + opt.percent / 100)), company, { medical: e.medical, transport: e.transport, food: e.food });
    rows.push({
        employeeId: e.id,
        effectiveDate: opt.effectiveDate,
        kind: "ANNUAL",
        oldDesignationId: e.designationId,
        newDesignationId: e.designationId,
        oldGradeId: e.gradeId,
        newGradeId: e.gradeId,
        oldGross: e.gross, oldBasic: e.basic, oldHouseRent: e.houseRent, oldMedical: e.medical, oldTransport: e.transport, oldFood: e.food,
        newGross: next.gross, newBasic: next.basic, newHouseRent: next.houseRent, newMedical: next.medical, newTransport: next.transport, newFood: next.food,
        percent: opt.percent,
        amount: round2(next.gross - e.gross),
    });
  }
  // One statement per 500 proposals instead of one per employee.
  for (let i = 0; i < rows.length; i += 500) await db.increment.createMany({ data: rows.slice(i, i + 500) });
  return rows.length;
}

export async function applyIncrement(db: PrismaClient, id: number, userName: string): Promise<void> {
  const inc = await db.increment.findUniqueOrThrow({ where: { id }, include: { newDesignation: true } });
  if (inc.status !== "APPROVED") throw new Error("Only approved increments can be applied.");
  await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: inc.employeeId },
      data: {
        designationId: inc.newDesignationId,
        gradeId: inc.newGradeId,
        empType: inc.newDesignation.empType,
        gross: inc.newGross,
        basic: inc.newBasic,
        houseRent: inc.newHouseRent,
        medical: inc.newMedical,
        transport: inc.newTransport,
        food: inc.newFood,
        salaryEffective: inc.effectiveDate,
      },
    });
    await tx.salaryHistory.create({
      data: {
        employeeId: inc.employeeId,
        effectiveDate: inc.effectiveDate,
        type: inc.kind === "PROMOTION" ? "PROMOTION" : "INCREMENT",
        designationId: inc.newDesignationId,
        gradeId: inc.newGradeId,
        gross: inc.newGross,
        basic: inc.newBasic,
        houseRent: inc.newHouseRent,
        medical: inc.newMedical,
        transport: inc.newTransport,
        food: inc.newFood,
        amount: inc.amount,
        remarks: inc.remarks,
        createdBy: userName,
      },
    });
    await tx.increment.update({ where: { id }, data: { status: "APPLIED", appliedAt: new Date() } });
  });
}
