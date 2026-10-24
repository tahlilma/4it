"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { FieldErrors, runAction, type FormState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { actionUser } from "@/lib/auth";
import { ADJUST_KINDS, FESTIVALS, RELIGIONS } from "@/lib/constants";
import { dmy, monthLabel, parseDate, parseMonth } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/num";
import { processBonus } from "@/lib/services/bonus";
import { generateElEncash } from "@/lib/services/elencash";
import { applyIncrement, generateIncrementProposals } from "@/lib/services/increment";
import { processPayroll } from "@/lib/services/payroll";
import { structureFromGross } from "@/lib/engine/salary";

// ───────────── Salary runs ─────────────

export async function createRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.process");
    const m = parseMonth(String(fd.get("month") ?? ""));
    if (!m) throw new FieldErrors({ month: "Choose a month" });
    const existing = await prisma.payrollRun.findUnique({ where: { year_month: { year: m.year, month: m.month } } });
    if (existing) redirect(`/payroll/${existing.id}`);
    const run = await prisma.payrollRun.create({ data: { year: m.year, month: m.month } });
    await audit(user, "CREATE", "PayrollRun", run.id, `Created payroll ${monthLabel(m.year, m.month)}`);
    redirect(`/payroll/${run.id}`);
  });
}

export async function processRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.process");
    const id = Number(fd.get("id"));
    const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id } });
    try {
      const r = await processPayroll(prisma, id, user.username);
      await audit(user, "PROCESS", "PayrollRun", id, `Processed payroll ${monthLabel(run.year, run.month)}: ${r.count} payslips`);
      refresh();
      return { ok: true, message: `Processed ${r.count} payslips.${r.warnings.length ? ` ${r.warnings.length} warning(s): ${r.warnings.slice(0, 3).join("; ")}` : ""}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
}

export async function lockRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.lock");
    const id = Number(fd.get("id"));
    const paymentDate = parseDate(String(fd.get("paymentDate") ?? ""));
    if (!paymentDate) throw new FieldErrors({ paymentDate: "Enter the date wages were / will be paid" });
    const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id } });
    if (run.status !== "PROCESSED") return { ok: false, error: "Process the payroll before locking it." };
    await prisma.payrollRun.update({ where: { id }, data: { status: "LOCKED", lockedAt: new Date(), lockedBy: user.username, paymentDate } });
    await audit(user, "LOCK", "PayrollRun", id, `Locked payroll ${monthLabel(run.year, run.month)}; payment date ${dmy(paymentDate)}`);
    refresh();
    return { ok: true, message: "Payroll locked." };
  });
}

export async function unlockRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.lock");
    const id = Number(fd.get("id"));
    const reason = String(fd.get("reason") ?? "").trim();
    if (reason.length < 10) throw new FieldErrors({ reason: "Explain why a paid payroll is being reopened (min. 10 characters)." });
    const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id } });
    if (run.status !== "LOCKED") return { ok: false, error: "Payroll is not locked." };
    await prisma.payrollRun.update({ where: { id }, data: { status: "PROCESSED", lockedAt: null, lockedBy: "", notes: `${run.notes}\nUnlocked by ${user.username}: ${reason}`.trim() } });
    await audit(user, "UNLOCK", "PayrollRun", id, `Unlocked payroll ${monthLabel(run.year, run.month)} — ${reason}`);
    refresh();
    return { ok: true, message: "Payroll unlocked." };
  });
}

// ───────────── Additions & deductions ─────────────

async function assertMonthOpen(year: number, month: number) {
  const run = await prisma.payrollRun.findUnique({ where: { year_month: { year, month } } });
  if (run?.status === "LOCKED") throw new FieldErrors({ month: `Payroll for ${monthLabel(year, month)} is locked.` });
}

export async function addAdjustment(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.process");
    const m = parseMonth(String(fd.get("month") ?? ""));
    const emp = await prisma.employee.findUnique({ where: { empCode: String(fd.get("emp") ?? "").trim() } });
    const kind = String(fd.get("kind") ?? "");
    const amount = Number(String(fd.get("amount") ?? "").replace(/,/g, ""));
    const reason = String(fd.get("reason") ?? "").trim();
    const errors: Record<string, string> = {};
    if (!m) errors.month = "Required";
    if (!emp) errors.emp = "No employee with this ID";
    if (!ADJUST_KINDS.some((k) => k.value === kind)) errors.kind = "Required";
    if (!(amount > 0)) errors.amount = "Positive amount";
    if (reason.length < 5) errors.reason = "A reason is required (shown on the audit trail; deductions must be lawful — s.125)";
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    await assertMonthOpen(m!.year, m!.month);
    await prisma.payAdjustment.create({ data: { employeeId: emp!.id, year: m!.year, month: m!.month, kind, amount: round2(amount), reason, createdBy: user.username } });
    await audit(user, "CREATE", "PayAdjustment", emp!.id, `${kind} ${amount} for ${monthLabel(m!.year, m!.month)} — ${reason}`);
    refresh();
    return { ok: true, message: "Saved. Re-process the payroll for the month to apply it." };
  });
}

export async function deleteAdjustment(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.process");
    const a = await prisma.payAdjustment.findUniqueOrThrow({ where: { id: Number(fd.get("id")) } });
    await assertMonthOpen(a.year, a.month);
    await prisma.payAdjustment.delete({ where: { id: a.id } });
    await audit(user, "DELETE", "PayAdjustment", a.employeeId, `Removed ${a.kind} ${a.amount} (${a.month}/${a.year})`);
    refresh();
    return { ok: true };
  });
}

// ───────────── Advances ─────────────

export async function addAdvance(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.process");
    const emp = await prisma.employee.findUnique({ where: { empCode: String(fd.get("emp") ?? "").trim() } });
    const date = parseDate(String(fd.get("date") ?? ""));
    const amount = Number(fd.get("amount"));
    const installments = Number(fd.get("installments"));
    const start = parseMonth(String(fd.get("start") ?? ""));
    const errors: Record<string, string> = {};
    if (!emp) errors.emp = "No employee with this ID";
    if (!date) errors.date = "Required";
    if (!(amount > 0)) errors.amount = "Positive amount";
    if (!(Number.isInteger(installments) && installments >= 1 && installments <= 36)) errors.installments = "1–36";
    if (!start) errors.start = "Required";
    if (emp && amount > 0 && installments >= 1 && amount / installments > emp.gross * 0.5) errors.installments = "Instalment exceeds half of gross pay — spread it over more months.";
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    const a = await prisma.advance.create({
      data: { employeeId: emp!.id, date: date!, amount: round2(amount), installments, startYear: start!.year, startMonth: start!.month, reason: String(fd.get("reason") ?? "").trim() },
    });
    await audit(user, "CREATE", "Advance", emp!.id, `Advance ${amount} in ${installments} instalments from ${start!.month}/${start!.year}`);
    refresh();
    return { ok: true, message: `Advance #${a.id} recorded.` };
  });
}

export async function closeAdvance(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.process");
    const a = await prisma.advance.findUniqueOrThrow({ where: { id: Number(fd.get("id")) }, include: { recoveries: true } });
    const recovered = a.recoveries.reduce((s, r) => s + r.amount, 0);
    const outstanding = round2(a.amount - recovered);
    if (outstanding > 0 && fd.get("cash") === "1") {
      await prisma.advanceRecovery.create({ data: { advanceId: a.id, year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() + 1, amount: outstanding, source: "CASH" } });
    }
    await prisma.advance.update({ where: { id: a.id }, data: { status: "CLOSED" } });
    await audit(user, "UPDATE", "Advance", a.employeeId, `Closed advance #${a.id}${outstanding > 0 ? ` (${outstanding} repaid in cash)` : ""}`);
    refresh();
    return { ok: true };
  });
}

// ───────────── Festival bonus ─────────────

export async function createBonusRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("bonus.manage");
    const title = String(fd.get("title") ?? "").trim();
    const festival = String(fd.get("festival") ?? "");
    const cutoff = parseDate(String(fd.get("cutoffDate") ?? ""));
    const payment = parseDate(String(fd.get("paymentDate") ?? ""));
    const basis = String(fd.get("basis") ?? "BASIC");
    const religions = fd.getAll("religions").map(String).filter((r) => RELIGIONS.some((x) => x.value === r));
    const p12 = Number(fd.get("p12") ?? 100), p6 = Number(fd.get("p6") ?? 0);
    const errors: Record<string, string> = {};
    if (!title) errors.title = "Required";
    if (!FESTIVALS.some((f) => f.value === festival)) errors.festival = "Required";
    if (!cutoff) errors.cutoffDate = "Required";
    if (!(p12 >= 0 && p12 <= 200)) errors.p12 = "0–200";
    if (!(p6 >= 0 && p6 <= 200)) errors.p6 = "0–200";
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    const slabs = [{ minMonths: 12, percent: p12 }, ...(p6 > 0 ? [{ minMonths: 6, percent: p6 }] : [])];
    const run = await prisma.bonusRun.create({
      data: {
        title, festival, cutoffDate: cutoff!, paymentDate: payment, basis: basis === "GROSS" ? "GROSS" : "BASIC",
        religions: religions.length === 0 || religions.length === RELIGIONS.length ? "ALL" : religions.join(","),
        slabs: JSON.stringify(slabs), stamp: Number(fd.get("stamp") ?? 0) || 0,
      },
    });
    await audit(user, "CREATE", "BonusRun", run.id, `Created bonus sheet ${title}`);
    redirect(`/payroll/bonus/${run.id}`);
  });
}

export async function processBonusRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("bonus.manage");
    const id = Number(fd.get("id"));
    const r = await processBonus(prisma, id);
    await audit(user, "PROCESS", "BonusRun", id, `Processed bonus: ${r.count} employees`);
    refresh();
    return { ok: true, message: `${r.count} employees eligible; ${r.excluded} not eligible for this festival / service length.` };
  });
}

export async function lockBonusRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.lock");
    const id = Number(fd.get("id"));
    const run = await prisma.bonusRun.findUniqueOrThrow({ where: { id } });
    if (run.status !== "PROCESSED") return { ok: false, error: "Process the bonus sheet first." };
    await prisma.bonusRun.update({ where: { id }, data: { status: "LOCKED" } });
    await audit(user, "LOCK", "BonusRun", id, `Locked bonus sheet ${run.title}`);
    refresh();
    return { ok: true, message: "Locked." };
  });
}

// ───────────── Increments & promotions ─────────────

export async function generateProposals(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("increment.propose");
    const effectiveDate = parseDate(String(fd.get("effectiveDate") ?? ""));
    const percent = Number(fd.get("percent"));
    if (!effectiveDate) throw new FieldErrors({ effectiveDate: "Required" });
    if (!(percent > 0 && percent <= 100)) throw new FieldErrors({ percent: "Enter a percentage" });
    const n = await generateIncrementProposals(prisma, { effectiveDate, percent, onlyDue: fd.get("all") !== "on" });
    await audit(user, "CREATE", "Increment", "", `Generated ${n} increment proposals (${percent}% effective ${dmy(effectiveDate)})`);
    refresh();
    return { ok: true, message: n ? `${n} proposals created.` : "No employees are due (12 months since joining or last increment) for this date." };
  });
}

export async function createPromotion(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("increment.propose");
    const emp = await prisma.employee.findUnique({ where: { empCode: String(fd.get("emp") ?? "").trim() } });
    const effectiveDate = parseDate(String(fd.get("effectiveDate") ?? ""));
    const newDesignationId = Number(fd.get("designationId")) || emp?.designationId;
    const newGradeId = Number(fd.get("gradeId")) || null;
    const newGross = Number(fd.get("gross"));
    const kind = String(fd.get("kind") ?? "PROMOTION");
    const errors: Record<string, string> = {};
    if (!emp) errors.emp = "No employee with this ID";
    if (!effectiveDate) errors.effectiveDate = "Required";
    if (!(newGross > 0)) errors.gross = "Enter the new gross";
    if (emp && newGross <= emp.gross) errors.gross = `Must be above the current gross (${emp.gross})`;
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    if (newGradeId) {
      const g = await prisma.grade.findUnique({ where: { id: newGradeId } });
      if (g && g.minGross > newGross) throw new FieldErrors({ gross: `Below the grade minimum (${g.minGross})` });
    }
    const company = await prisma.company.findFirstOrThrow();
    const next = structureFromGross(newGross, company, { medical: emp!.medical, transport: emp!.transport, food: emp!.food });
    await prisma.increment.create({
      data: {
        employeeId: emp!.id, effectiveDate: effectiveDate!, kind: kind === "SPECIAL" ? "SPECIAL" : "PROMOTION",
        oldDesignationId: emp!.designationId, newDesignationId: newDesignationId!, oldGradeId: emp!.gradeId, newGradeId: newGradeId ?? emp!.gradeId,
        oldGross: emp!.gross, oldBasic: emp!.basic, oldHouseRent: emp!.houseRent, oldMedical: emp!.medical, oldTransport: emp!.transport, oldFood: emp!.food,
        newGross: next.gross, newBasic: next.basic, newHouseRent: next.houseRent, newMedical: next.medical, newTransport: next.transport, newFood: next.food,
        percent: round2(((next.gross - emp!.gross) / emp!.gross) * 100), amount: round2(next.gross - emp!.gross), remarks: String(fd.get("remarks") ?? "").trim(),
      },
    });
    await audit(user, "CREATE", "Increment", emp!.id, `${kind} proposal for ${emp!.empCode}: ${emp!.gross} → ${next.gross}`);
    refresh();
    return { ok: true, message: "Proposal created." };
  });
}

export async function decideIncrement(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("increment.approve");
    const ids = fd.getAll("id").map(Number).filter(Boolean);
    const decision = String(fd.get("decision") ?? "");
    if (!["APPROVED", "REJECTED"].includes(decision)) return { ok: false, error: "Invalid decision." };
    const r = await prisma.increment.updateMany({ where: { id: { in: ids }, status: "PROPOSED" }, data: { status: decision, decidedBy: user.username } });
    await audit(user, decision === "APPROVED" ? "APPROVE" : "REJECT", "Increment", ids.join(","), `${decision.toLowerCase()} ${r.count} increment proposal(s)`);
    refresh();
    return { ok: true, message: `${r.count} proposal(s) ${decision.toLowerCase()}.` };
  });
}

export async function applyIncrements(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("salary.edit");
    const ids = fd.getAll("id").map(Number).filter(Boolean);
    const company = await prisma.company.findFirstOrThrow();
    const today = new Date(Date.now() + company.tzOffsetMinutes * 60000);
    let applied = 0;
    const skipped: string[] = [];
    for (const id of ids) {
      const inc = await prisma.increment.findUnique({ where: { id }, include: { employee: true } });
      if (!inc || inc.status !== "APPROVED") continue;
      if (inc.effectiveDate.getTime() > today.getTime()) {
        skipped.push(inc.employee.empCode);
        continue;
      }
      await applyIncrement(prisma, id, user.username);
      await audit(user, "APPLY", "Increment", inc.employeeId, `Applied ${inc.kind.toLowerCase()} for ${inc.employee.empCode}: ${inc.oldGross} → ${inc.newGross}`);
      applied++;
    }
    refresh();
    return { ok: true, message: `${applied} applied.${skipped.length ? ` Not yet effective: ${skipped.slice(0, 10).join(", ")}.` : ""}` };
  });
}

/** One form, three buttons: approve / reject / apply the ticked proposals. */
export async function incrementBulk(prev: FormState | null, fd: FormData): Promise<FormState> {
  const op = String(fd.get("op") ?? "");
  const allView = String(fd.get("allView") ?? "");
  if (allView === "PROPOSED" || allView === "APPROVED") {
    const every = await prisma.increment.findMany({ where: { status: allView }, select: { id: true } });
    fd.delete("id");
    for (const r of every) fd.append("id", String(r.id));
  }
  if (!fd.getAll("id").length) return { ok: false, error: "Tick at least one proposal." };
  if (op === "apply") return applyIncrements(prev, fd);
  fd.set("decision", op === "approve" ? "APPROVED" : "REJECTED");
  return decideIncrement(prev, fd);
}

// ───────────── Earned-leave encashment ─────────────

export async function createElRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.process");
    const asOf = parseDate(String(fd.get("asOfDate") ?? ""));
    const title = String(fd.get("title") ?? "").trim();
    if (!asOf) throw new FieldErrors({ asOfDate: "Required" });
    if (!title) throw new FieldErrors({ title: "Required" });
    const sameYear = await prisma.elEncashRun.findFirst({ where: { status: "POSTED", asOfDate: { gte: new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1)), lte: new Date(Date.UTC(asOf.getUTCFullYear(), 11, 31)) } } });
    if (sameYear) return { ok: false, error: `An encashment for ${asOf.getUTCFullYear()} is already posted — r.107(2) allows encashment once a year.` };
    const run = await prisma.elEncashRun.create({ data: { title, asOfDate: asOf } });
    const n = await generateElEncash(prisma, run.id);
    await audit(user, "CREATE", "ElEncashRun", run.id, `EL encashment ${title}: ${n} employees`);
    redirect(`/payroll/el-encashment?run=${run.id}`);
  });
}

export async function regenerateElRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    await actionUser("payroll.process");
    const n = await generateElEncash(prisma, Number(fd.get("id")));
    refresh();
    return { ok: true, message: `${n} employees.` };
  });
}

export async function postElRun(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("payroll.lock");
    const id = Number(fd.get("id"));
    const run = await prisma.elEncashRun.findUniqueOrThrow({ where: { id } });
    if (run.status === "POSTED") return { ok: false, error: "Already posted." };
    await prisma.elEncashRun.update({ where: { id }, data: { status: "POSTED" } });
    await audit(user, "LOCK", "ElEncashRun", id, `Posted EL encashment ${run.title} (balances reduced)`);
    refresh();
    return { ok: true, message: "Posted — encashed days are deducted from earned-leave balances." };
  });
}
