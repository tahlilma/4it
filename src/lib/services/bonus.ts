// Festival bonus processing.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { roundTk } from "../num";
import { bonusFor, parseSlabs } from "../engine/bonus";

export async function processBonus(db: PrismaClient, runId: number): Promise<{ count: number; excluded: number }> {
  const run = await db.bonusRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === "LOCKED") throw new Error("This bonus sheet is locked.");
  const slabs = parseSlabs(run.slabs);
  const employees = await db.employee.findMany({
    where: { joinDate: { lte: run.cutoffDate }, OR: [{ separationDate: null }, { separationDate: { gte: run.cutoffDate } }] },
  });
  const lines: Prisma.BonusLineCreateManyInput[] = [];
  let excluded = 0;
  for (const e of employees) {
    const c = bonusFor(e, { cutoffDate: run.cutoffDate, basis: run.basis, religions: run.religions, slabs });
    if (!c || c.amount <= 0) {
      excluded++;
      continue;
    }
    const stamp = c.amount > run.stamp ? run.stamp : 0;
    lines.push({
      runId,
      employeeId: e.id,
      departmentId: e.departmentId,
      sectionId: e.sectionId,
      designationId: e.designationId,
      empType: e.empType,
      paymentMode: e.paymentMode,
      serviceMonths: c.serviceMonths,
      basic: e.basic,
      gross: e.gross,
      percent: c.percent,
      amount: c.amount,
      stamp,
      net: roundTk(c.amount - stamp),
    });
  }
  await db.$transaction(async (tx) => {
    await tx.bonusLine.deleteMany({ where: { runId } });
    for (let i = 0; i < lines.length; i += 1000) await tx.bonusLine.createMany({ data: lines.slice(i, i + 1000) });
    await tx.bonusRun.update({ where: { id: runId }, data: { status: "PROCESSED" } });
  });
  return { count: lines.length, excluded };
}
