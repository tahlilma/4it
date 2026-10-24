"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { FieldErrors, runAction, type FormState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { actionUser } from "@/lib/auth";
import { SEPARATION_TYPES } from "@/lib/constants";
import { addDays, diffDays, dmy, parseDate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/num";
import { processAttendance } from "@/lib/services/attendance";
import { calculateSettlement } from "@/lib/services/settlement";

export async function createSeparation(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("separation.manage");
    const emp = await prisma.employee.findUnique({ where: { empCode: String(fd.get("emp") ?? "").trim() }, include: { separation: true } });
    const type = String(fd.get("type") ?? "");
    const effective = parseDate(String(fd.get("effectiveDate") ?? ""));
    const notice = parseDate(String(fd.get("noticeDate") ?? ""));
    const reason = String(fd.get("reason") ?? "").trim();
    const errors: Record<string, string> = {};
    if (!emp) errors.emp = "No employee with this ID";
    else if (emp.separation) errors.emp = "This employee already has a separation record";
    if (!SEPARATION_TYPES.some((t) => t.value === type)) errors.type = "Choose the separation type";
    if (!effective) errors.effectiveDate = "Required";
    if (emp && effective && effective < emp.joinDate) errors.effectiveDate = "Before the joining date";
    if (notice && effective && notice > effective) errors.noticeDate = "Notice must be on or before the last working day";
    if (!reason) errors.reason = "Required";
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    const noticeDays = Number(fd.get("noticeDays") ?? "") || (notice && effective ? diffDays(notice, effective) : 0);
    const sep = await prisma.$transaction(async (tx) => {
      const s = await tx.separation.create({
        data: { employeeId: emp!.id, type, noticeDate: notice, effectiveDate: effective!, reason, noticeDaysGiven: Math.max(0, noticeDays), diedOnDuty: fd.get("diedOnDuty") === "on", createdBy: user.username },
      });
      await tx.employee.update({ where: { id: emp!.id }, data: { status: "SEPARATED", separationDate: effective! } });
      await tx.leftyCase.updateMany({ where: { employeeId: emp!.id, status: "OPEN" }, data: { status: type === "LEFTY" ? "SEPARATED" : "CANCELLED" } });
      await tx.leaveApplication.updateMany({ where: { employeeId: emp!.id, status: "PENDING", fromDate: { gt: effective! } }, data: { status: "CANCELLED", decisionNote: "Employee separated" } });
      return s;
    });
    const company = await prisma.company.findFirstOrThrow();
    const today = todayLocal(company.tzOffsetMinutes);
    if (addDays(effective!, 1) <= today) await processAttendance(prisma, { from: addDays(effective!, 1), to: today, employeeIds: [emp!.id] });
    await audit(user, "CREATE", "Separation", emp!.id, `${type} — last working day ${dmy(effective!)} — ${reason}`);
    await calculateSettlement(prisma, sep.id);
    redirect(`/separations/${sep.id}?created=1`);
  });
}

export async function recalcSettlement(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("separation.manage");
    const id = Number(fd.get("id"));
    const num = (k: string) => {
      const s = String(fd.get(k) ?? "").trim();
      return s === "" ? undefined : Number(s);
    };
    const benefit = num("benefitDays");
    const remarks = String(fd.get("remarks") ?? "").trim();
    if (benefit !== undefined && remarks.length < 5) throw new FieldErrors({ remarks: "Explain the manual benefit days (e.g. company policy above the statutory minimum)." });
    const r = await calculateSettlement(prisma, id, {
      otherAddition: num("otherAddition") ?? 0,
      otherDeduction: num("otherDeduction") ?? 0,
      benefitDaysOverride: benefit ?? null,
      remarks,
    });
    const sep = await prisma.separation.findUniqueOrThrow({ where: { id } });
    await audit(user, "PROCESS", "Separation", sep.employeeId, `Settlement calculated: net ${r.netPayable}`);
    refresh();
    return { ok: true, message: `Recalculated — net payable Tk ${r.netPayable.toLocaleString("en-IN")}.` };
  });
}

export async function markSettlementPaid(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("settlement.approve");
    const id = Number(fd.get("id"));
    const paidOn = parseDate(String(fd.get("paidOn") ?? ""));
    if (!paidOn) throw new FieldErrors({ paidOn: "Required" });
    const sep = await prisma.separation.findUniqueOrThrow({ where: { id } });
    if (sep.settlementStatus !== "CALCULATED") return { ok: false, error: "Calculate the settlement first." };
    await prisma.$transaction(async (tx) => {
      // Recover outstanding advances from the settlement.
      const advances = await tx.advance.findMany({ where: { employeeId: sep.employeeId }, include: { recoveries: true } });
      for (const a of advances) {
        const out = round2(a.amount - a.recoveries.reduce((s, r) => s + r.amount, 0));
        if (out > 0) await tx.advanceRecovery.create({ data: { advanceId: a.id, year: paidOn.getUTCFullYear(), month: paidOn.getUTCMonth() + 1, amount: out, source: "SETTLEMENT" } });
        if (a.status !== "CLOSED") await tx.advance.update({ where: { id: a.id }, data: { status: "CLOSED" } });
      }
      await tx.separation.update({ where: { id }, data: { settlementStatus: "PAID", paidOn } });
    });
    await audit(user, "APPROVE", "Separation", sep.employeeId, `Final settlement paid on ${dmy(paidOn)} — Tk ${sep.netPayable}`);
    refresh();
    return { ok: true, message: "Recorded as paid." };
  });
}

export async function reinstate(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("separation.manage");
    const id = Number(fd.get("id"));
    const reason = String(fd.get("reason") ?? "").trim();
    if (reason.length < 5) throw new FieldErrors({ reason: "Explain why the separation is withdrawn." });
    const sep = await prisma.separation.findUniqueOrThrow({ where: { id } });
    if (sep.settlementStatus === "PAID") return { ok: false, error: "The settlement has been paid; a returning worker must be re-hired as a new joiner." };
    await prisma.$transaction(async (tx) => {
      await tx.separation.delete({ where: { id } });
      await tx.employee.update({ where: { id: sep.employeeId }, data: { status: "ACTIVE", separationDate: null } });
    });
    const company = await prisma.company.findFirstOrThrow();
    const today = todayLocal(company.tzOffsetMinutes);
    if (addDays(sep.effectiveDate, 1) <= today) await processAttendance(prisma, { from: addDays(sep.effectiveDate, 1), to: today, employeeIds: [sep.employeeId] });
    await audit(user, "DELETE", "Separation", sep.employeeId, `Separation withdrawn — ${reason}`);
    redirect(`/employees/${sep.employeeId}?saved=1`);
  });
}

// ───────────── Lefty (s.27(3A)) ─────────────

export async function openLeftyCase(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("separation.manage");
    const employeeId = Number(fd.get("employeeId"));
    const absentFrom = parseDate(String(fd.get("absentFrom") ?? ""));
    if (!absentFrom) return { ok: false, error: "Missing absence start date." };
    const open = await prisma.leftyCase.findFirst({ where: { employeeId, status: "OPEN" } });
    if (open) return { ok: false, error: "A case is already open." };
    await prisma.leftyCase.create({ data: { employeeId, absentFrom } });
    await audit(user, "CREATE", "Separation", employeeId, `Lefty case opened — absent since ${dmy(absentFrom)}`);
    refresh();
    return { ok: true, message: "Case opened. Print and send the first letter." };
  });
}

export async function updateLeftyCase(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("separation.manage");
    const id = Number(fd.get("id"));
    const op = String(fd.get("op") ?? "");
    const c = await prisma.leftyCase.findUniqueOrThrow({ where: { id }, include: { employee: true } });
    if (c.status !== "OPEN") return { ok: false, error: "Case is closed." };
    const company = await prisma.company.findFirstOrThrow();
    const today = todayLocal(company.tzOffsetMinutes);
    const date = parseDate(String(fd.get("date") ?? "")) ?? today;
    switch (op) {
      case "letter1":
        await prisma.leftyCase.update({ where: { id }, data: { letter1Date: date } });
        break;
      case "letter2":
        if (!c.letter1Date) return { ok: false, error: "Send the first letter first." };
        if (diffDays(c.letter1Date, date) < 10) return { ok: false, error: "s.27(3A): allow 10 days after the first letter before the second." };
        await prisma.leftyCase.update({ where: { id }, data: { letter2Date: date } });
        break;
      case "letter3":
        if (!c.letter2Date) return { ok: false, error: "Send the second letter first." };
        if (diffDays(c.letter2Date, date) < 7) return { ok: false, error: "s.27(3A): allow 7 days for self-defence after the second letter." };
        await prisma.leftyCase.update({ where: { id }, data: { letter3Date: date } });
        break;
      case "rejoined":
        await prisma.leftyCase.update({ where: { id }, data: { status: "REJOINED", remarks: String(fd.get("remarks") ?? "Rejoined") } });
        break;
      case "cancel":
        await prisma.leftyCase.update({ where: { id }, data: { status: "CANCELLED" } });
        break;
      case "separate": {
        if (!c.letter3Date) return { ok: false, error: "All three letters must be issued before treating the worker as having resigned." };
        const last = addDays(c.absentFrom, -1);
        const sep = await prisma.$transaction(async (tx) => {
          const s = await tx.separation.create({
            data: { employeeId: c.employeeId, type: "LEFTY", effectiveDate: last, reason: `Absent without leave since ${dmy(c.absentFrom)}; letters ${dmy(c.letter1Date)}, ${dmy(c.letter2Date)}, ${dmy(c.letter3Date)} (s.27(3A))`, createdBy: user.username },
          });
          await tx.employee.update({ where: { id: c.employeeId }, data: { status: "SEPARATED", separationDate: last } });
          await tx.leftyCase.update({ where: { id }, data: { status: "SEPARATED" } });
          return s;
        });
        await processAttendance(prisma, { from: c.absentFrom, to: today, employeeIds: [c.employeeId] });
        await calculateSettlement(prisma, sep.id);
        await audit(user, "CREATE", "Separation", c.employeeId, `Deemed resignation (lefty) effective ${dmy(last)}`);
        redirect(`/separations/${sep.id}?created=1`);
      }
      default:
        return { ok: false, error: "Unknown operation." };
    }
    await audit(user, "UPDATE", "Separation", c.employeeId, `Lefty case: ${op} ${dmy(date)}`);
    refresh();
    return { ok: true, message: "Updated." };
  });
}

// ───────────── Maternity (ss.45–50) ─────────────

export async function createMaternityCase(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("leave.approve");
    const { computeMaternity } = await import("@/lib/engine/maternity");
    const emp = await prisma.employee.findUnique({ where: { empCode: String(fd.get("emp") ?? "").trim() } });
    const noticeDate = parseDate(String(fd.get("noticeDate") ?? ""));
    const expected = parseDate(String(fd.get("expectedDelivery") ?? ""));
    const children = Number(fd.get("survivingChildren") ?? 0);
    const errors: Record<string, string> = {};
    if (!emp) errors.emp = "No employee with this ID";
    else if (emp.gender !== "FEMALE") errors.emp = "Maternity benefit applies to women workers";
    if (!noticeDate) errors.noticeDate = "Required";
    if (!expected) errors.expectedDelivery = "Required";
    if (!(Number.isInteger(children) && children >= 0)) errors.survivingChildren = "Whole number";
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    // Wages of the 3 months before the notice (s.48): from processed payslips unless entered manually.
    const manualWages = String(fd.get("wages3m") ?? "").trim();
    const manualDays = String(fd.get("daysWorked3m") ?? "").trim();
    let wages3m = Number(manualWages), daysWorked3m = Number(manualDays);
    if (!manualWages || !manualDays) {
      const months: { year: number; month: number }[] = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(Date.UTC(noticeDate!.getUTCFullYear(), noticeDate!.getUTCMonth() - i, 1));
        months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
      }
      const agg = await prisma.payslip.aggregate({ where: { employeeId: emp!.id, run: { OR: months } }, _sum: { grossPayable: true, presentDays: true } });
      wages3m = agg._sum.grossPayable ?? 0;
      daysWorked3m = agg._sum.presentDays ?? 0;
    }
    const calc = computeMaternity({ joinDate: emp!.joinDate, expectedDelivery: expected!, survivingChildren: children, wages3m, daysWorked3m });
    const mc = await prisma.maternityCase.create({
      data: {
        employeeId: emp!.id, noticeDate: noticeDate!, expectedDelivery: expected!, leaveFrom: calc.leaveFrom, leaveTo: calc.leaveTo,
        serviceMonths: calc.serviceMonths, survivingChildren: children, benefitEligible: calc.benefitEligible, wages3m, daysWorked3m,
        avgDailyWage: calc.avgDailyWage, totalBenefit: calc.totalBenefit, firstInstallment: calc.firstInstallment, secondInstallment: calc.secondInstallment,
        remarks: calc.reason,
      },
    });
    if (fd.get("createLeave") === "on") {
      const ml = await prisma.leaveType.findFirst({ where: { code: "ML" } });
      if (ml) {
        const overlap = await prisma.leaveApplication.findFirst({ where: { employeeId: emp!.id, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: calc.leaveTo }, toDate: { gte: calc.leaveFrom } } });
        if (!overlap) {
          await prisma.leaveApplication.create({
            data: { employeeId: emp!.id, leaveTypeId: ml.id, fromDate: calc.leaveFrom, toDate: calc.leaveTo, days: 112, reason: "Maternity leave (s.46)", appliedOn: noticeDate!, status: "APPROVED", decidedBy: user.username, decidedAt: new Date() },
          });
          const company = await prisma.company.findFirstOrThrow();
          const today = todayLocal(company.tzOffsetMinutes);
          if (calc.leaveFrom <= today) await processAttendance(prisma, { from: calc.leaveFrom, to: calc.leaveTo < today ? calc.leaveTo : today, employeeIds: [emp!.id] });
        }
      }
    }
    await audit(user, "CREATE", "Leave", emp!.id, `Maternity case: expected ${dmy(expected!)}, benefit Tk ${calc.totalBenefit}`);
    redirect(`/maternity?case=${mc.id}`);
  });
}

export async function updateMaternityCase(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("leave.approve");
    const id = Number(fd.get("id"));
    const op = String(fd.get("op") ?? "");
    const date = parseDate(String(fd.get("date") ?? ""));
    if (!date && op !== "close") throw new FieldErrors({ date: "Enter the date" });
    const mc = await prisma.maternityCase.findUniqueOrThrow({ where: { id } });
    const data =
      op === "first" ? { firstPaidOn: date, status: "ON_LEAVE" } :
      op === "second" ? { secondPaidOn: date } :
      op === "delivered" ? { actualDelivery: date } :
      op === "close" ? { status: "CLOSED" } : null;
    if (!data) return { ok: false, error: "Unknown operation." };
    await prisma.maternityCase.update({ where: { id }, data });
    await audit(user, "UPDATE", "Leave", mc.employeeId, `Maternity case ${op} ${date ? dmy(date) : ""}`);
    refresh();
    return { ok: true, message: "Updated." };
  });
}
