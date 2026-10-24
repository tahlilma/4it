// Annual earned-leave encashment (Labour Rules r.107(2): at most half the balance, once a year).

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { monthsBetween } from "../dates";
import { round2, roundTk } from "../num";
import { elEncashable } from "../engine/leave";
import { leaveBalances } from "./leave";

export async function generateElEncash(db: PrismaClient, runId: number): Promise<number> {
  const run = await db.elEncashRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === "POSTED") throw new Error("This encashment sheet is already posted.");
  const company = await db.company.findFirstOrThrow();
  const asOf = run.asOfDate;
  const employees = await db.employee.findMany({ where: { status: "ACTIVE", joinDate: { lte: asOf } } });
  const eligible = employees.filter((e) => monthsBetween(e.joinDate, asOf) >= company.elEligibleMonths);
  const balances = await leaveBalances(db, eligible.map((e) => e.id), asOf.getUTCFullYear(), asOf);

  const lines: Prisma.ElEncashLineCreateManyInput[] = [];
  for (const e of eligible) {
    const el = balances.get(e.id)?.find((b) => b.accrual === "EARNED");
    if (!el) continue;
    const encashDays = elEncashable(el.balance, company.elEncashMaxPercent);
    if (encashDays <= 0) continue;
    const rate = round2((company.elRateBasis === "BASIC" ? e.basic : e.gross) / 30);
    const amount = round2(encashDays * rate);
    const stamp = e.paymentMode === "CASH" ? company.stampCash : company.stampBank;
    lines.push({
      runId,
      employeeId: e.id,
      earnedDays: el.entitlement,
      availedDays: el.availed,
      balanceDays: el.balance,
      encashDays,
      rate,
      amount,
      stamp,
      net: Math.max(0, roundTk(amount - stamp)),
    });
  }
  await db.$transaction(async (tx) => {
    await tx.elEncashLine.deleteMany({ where: { runId } });
    for (let i = 0; i < lines.length; i += 1000) await tx.elEncashLine.createMany({ data: lines.slice(i, i + 1000) });
  });
  return lines.length;
}
