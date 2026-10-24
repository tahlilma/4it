"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { FieldErrors, runAction, type FormState } from "@/lib/action";
import { audit } from "@/lib/audit";
import { actionUser, hashPassword } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { prisma } from "@/lib/db";

function checkPassword(pw: string): string | null {
  if (pw.length < 8) return "At least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Use letters and numbers.";
  return null;
}

export async function createUser(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await actionUser("users.manage");
    const username = String(fd.get("username") ?? "").trim().toLowerCase();
    const name = String(fd.get("name") ?? "").trim();
    const role = String(fd.get("role") ?? "");
    const password = String(fd.get("password") ?? "");
    const errors: Record<string, string> = {};
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) errors.username = "3–30 characters: letters, digits, dot, dash or underscore.";
    if (!name) errors.name = "Required";
    if (!ROLES.some((r) => r.value === role)) errors.role = "Choose a role";
    const pwErr = checkPassword(password);
    if (pwErr) errors.password = pwErr;
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    const u = await prisma.user.create({ data: { username, name, role, passwordHash: await hashPassword(password) } });
    await audit(me, "CREATE", "User", u.id, `Created user ${username} (${role})`);
    refresh();
    return { ok: true, message: `User ${username} created.` };
  });
}

export async function updateUser(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await actionUser("users.manage");
    const id = Number(fd.get("id"));
    const name = String(fd.get("name") ?? "").trim();
    const role = String(fd.get("role") ?? "");
    const active = fd.get("active") === "on";
    const password = String(fd.get("password") ?? "");
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    const errors: Record<string, string> = {};
    if (!name) errors.name = "Required";
    if (!ROLES.some((r) => r.value === role)) errors.role = "Choose a role";
    if (password) {
      const pwErr = checkPassword(password);
      if (pwErr) errors.password = pwErr;
    }
    if (id === me.id && (!active || role !== "ADMIN") && me.role === "ADMIN") errors.role = "You cannot remove your own administrator access.";
    if (Object.keys(errors).length) throw new FieldErrors(errors);
    if (user.role === "ADMIN" && (role !== "ADMIN" || !active)) {
      const admins = await prisma.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
      if (admins === 0) throw new FieldErrors({ role: "At least one active administrator is required." });
    }
    await prisma.user.update({
      where: { id },
      data: { name, role, active, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
    });
    if (!active || password) await prisma.session.deleteMany({ where: { userId: id } });
    await audit(me, "UPDATE", "User", id, `Updated user ${user.username}${password ? " (password reset)" : ""}`, {
      role: [user.role, role],
      active: [user.active, active],
    });
    redirect("/setup/users?saved=1");
  });
}

export async function changeOwnPassword(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const me = await actionUser();
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    const bcrypt = (await import("bcryptjs")).default;
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new FieldErrors({ current: "Current password is incorrect." });
    const pwErr = checkPassword(next);
    if (pwErr) throw new FieldErrors({ next: pwErr });
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
    await audit(me, "UPDATE", "User", me.id, "Changed own password");
    return { ok: true, message: "Password changed." };
  });
}
