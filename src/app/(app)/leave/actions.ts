"use server";

import { refresh } from "next/cache";
import { FieldErrors, runAction, type FormState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { actionUser, can } from "@/lib/auth";
import { dmy, minDate, parseDate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { leaveDays } from "@/lib/engine/leave";
import { processAttendance } from "@/lib/services/attendance";
import { leaveBalances } from "@/lib/services/leave";

async function lockedMonth(from: Date, to: Date): Promise<string | null> {
  const runs = await prisma.payrollRun.findMany({ where: { status: "LOCKED" } });
  for (const r of runs) {
    const mStart = new Date(Date.UTC(r.year, r.month - 1, 1));
    const mEnd = new Date(Date.UTC(r.year, r.month, 0));
    if (from <= mEnd && to >= mStart) return `${r.month}/${r.year}`;
  }
  return null;
}

/** Validates an application against entitlement and overlaps. Returns an error message or null. */
async function validate(employeeId: number, leaveTypeId: number, from: Date, to: Date, days: number, excludeId?: number): Promise<string | null> {
  const [emp, type] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
    prisma.leaveType.findUniqueOrThrow({ where: { id: leaveTypeId } }),
  ]);
  if (from < emp.joinDate) return "Leave cannot start before the joining date.";
  if (emp.separationDate && to > emp.separationDate) return "Leave extends beyond the employee's last working day.";
  if (type.gender && type.gender !== emp.gender) return `${type.nameEn} applies only to ${type.gender.toLowerCase()} employees.`;
  const overlap = await prisma.leaveApplication.findFirst({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: to }, toDate: { gte: from }, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (overlap) return `Overlaps another application (${dmy(overlap.fromDate)} – ${dmy(overlap.toDate)}).`;
  if (from.getUTCFullYear() !== to.getUTCFullYear() && type.accrual === "FIXED") return "Split leave that crosses the year end into two applications.";
  if (type.accrual !== "NONE") {
    const bal = (await leaveBalances(prisma, [employeeId], from.getUTCFullYear(), to)).get(employeeId)?.find((b) => b.code === type.code);
    if (bal) {
      if (type.accrual === "EARNED" && !bal.eligible) return "Earned leave can be taken only after one year of continuous service (s.117).";
      // Balances count approved leave only, so a pending application being approved is not double-counted.
      if (days > bal.balance) return `${type.code} balance is ${bal.balance} day(s); ${days} requested.`;
    }
  }
  return null;
}

export async function createLeave(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("leave.edit");
    const code = String(fd.get("emp") ?? "").trim();
    const emp = await prisma.employee.findUnique({ where: { empCode: code } });
    const leaveTypeId = Number(fd.get("leaveTypeId"));
    const from = parseDate(String(fd.get("from") ?? ""));
    const to = parseDate(String(fd.get("to") ?? ""));
    const reason = String(fd.get("reason") ?? "").trim();
    const errors: Record<string, string> = {};
    if (!emp) errors.emp = "No employee with this ID";
    else if (emp.status !== "ACTIVE") errors.emp = "Employee is not active";
    if (!leaveTypeId) errors.leaveTypeId = "Choose a leave type";
    if (!from) errors.from = "Required";
    if (!to) errors.to = "Required";
    if (from && to && to < from) errors.to = "Must be on or after the start date";
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    const span = leaveDays(from!, to!);
    const daysRaw = String(fd.get("days") ?? "").trim();
    const days = daysRaw ? Number(daysRaw) : span;
    if (!(days > 0 && days <= span && Math.round(days * 2) === days * 2)) throw new FieldErrors({ days: `Between 0.5 and ${span}, in half days.` });
    const locked = await lockedMonth(from!, to!);
    if (locked) return { ok: false, error: `Payroll for ${locked} is locked; leave in that month can't be added.` };
    const err = await validate(emp!.id, leaveTypeId, from!, to!, days);
    if (err) return { ok: false, error: err };
    const approve = fd.get("approve") === "on" && can(user, "leave.approve");
    const company = await prisma.company.findFirstOrThrow();
    const today = todayLocal(company.tzOffsetMinutes);
    const app = await prisma.leaveApplication.create({
      data: {
        employeeId: emp!.id, leaveTypeId, fromDate: from!, toDate: to!, days, reason,
        appliedOn: parseDate(String(fd.get("appliedOn") ?? "")) ?? today,
        status: approve ? "APPROVED" : "PENDING",
        decidedBy: approve ? user.username : "",
        decidedAt: approve ? new Date() : null,
      },
      include: { leaveType: true },
    });
    if (approve && from! <= today) await processAttendance(prisma, { from: from!, to: minDate(to!, today), employeeIds: [emp!.id] });
    await audit(user, "CREATE", "Leave", emp!.id, `${app.leaveType.code} ${dmy(from!)} – ${dmy(to!)} (${days} d) ${approve ? "approved" : "applied"}`);
    refresh();
    return { ok: true, message: `${app.leaveType.code} leave ${approve ? "approved" : "recorded — awaiting approval"} for ${emp!.empCode}.` };
  });
}

export async function decideLeave(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("leave.approve");
    const id = Number(fd.get("id"));
    const decision = String(fd.get("decision") ?? "");
    const app = await prisma.leaveApplication.findUniqueOrThrow({ where: { id }, include: { leaveType: true } });
    if (app.status !== "PENDING") return { ok: false, error: "Only pending applications can be decided." };
    if (decision === "APPROVED") {
      const locked = await lockedMonth(app.fromDate, app.toDate);
      if (locked) return { ok: false, error: `Payroll for ${locked} is locked.` };
      const err = await validate(app.employeeId, app.leaveTypeId, app.fromDate, app.toDate, app.days, app.id);
      if (err) return { ok: false, error: err };
    } else if (decision !== "REJECTED") return { ok: false, error: "Invalid decision." };
    await prisma.leaveApplication.update({ where: { id }, data: { status: decision, decidedBy: user.username, decidedAt: new Date(), decisionNote: String(fd.get("note") ?? "") } });
    const company = await prisma.company.findFirstOrThrow();
    const today = todayLocal(company.tzOffsetMinutes);
    if (decision === "APPROVED" && app.fromDate <= today) await processAttendance(prisma, { from: app.fromDate, to: minDate(app.toDate, today), employeeIds: [app.employeeId] });
    await audit(user, decision === "APPROVED" ? "APPROVE" : "REJECT", "Leave", app.employeeId, `${app.leaveType.code} ${dmy(app.fromDate)} – ${dmy(app.toDate)} ${decision.toLowerCase()}`);
    refresh();
    return { ok: true, message: `Leave ${decision.toLowerCase()}.` };
  });
}

export async function cancelLeave(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("leave.approve");
    const id = Number(fd.get("id"));
    const app = await prisma.leaveApplication.findUniqueOrThrow({ where: { id }, include: { leaveType: true } });
    if (!["PENDING", "APPROVED"].includes(app.status)) return { ok: false, error: "Already closed." };
    const locked = await lockedMonth(app.fromDate, app.toDate);
    if (locked && app.status === "APPROVED") return { ok: false, error: `Payroll for ${locked} is locked.` };
    await prisma.leaveApplication.update({ where: { id }, data: { status: "CANCELLED", decidedBy: user.username, decidedAt: new Date() } });
    const company = await prisma.company.findFirstOrThrow();
    const today = todayLocal(company.tzOffsetMinutes);
    if (app.status === "APPROVED" && app.fromDate <= today) await processAttendance(prisma, { from: app.fromDate, to: minDate(app.toDate, today), employeeIds: [app.employeeId] });
    await audit(user, "CANCEL", "Leave", app.employeeId, `${app.leaveType.code} ${dmy(app.fromDate)} – ${dmy(app.toDate)} cancelled`);
    refresh();
    return { ok: true, message: "Leave cancelled." };
  });
}
