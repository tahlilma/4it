import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { prisma } from "./db";
import { hasPerm, type Perm } from "./rbac";

export const SESSION_COOKIE = "hrp_session";
const SESSION_HOURS = 12;

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function clientInfo(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  return { ip, userAgent: (h.get("user-agent") ?? "").slice(0, 200) };
}

/** Verifies credentials and starts a session. Error messages never reveal which part was wrong. */
export async function login(username: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
  const valid = !!user && user.active && (await bcrypt.compare(password, user.passwordHash));
  const { ip, userAgent } = await clientInfo();
  if (!user || !valid) {
    await prisma.auditLog.create({
      data: { action: "LOGIN_FAILED", entity: "User", entityId: username.slice(0, 50), userName: username.slice(0, 50), ip },
    });
    return { ok: false, error: "Invalid username or password." };
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await prisma.session.create({ data: { id: hashToken(token), userId: user.id, expiresAt, ip, userAgent } });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.auditLog.create({ data: { action: "LOGIN", entity: "User", entityId: String(user.id), userId: user.id, userName: user.username, ip } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Current user for this request (memoised per request). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Sessions are per request (and compared with the clock), never part of a prerendered shell.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!s || s.expiresAt.getTime() < Date.now() || !s.user.active) return null;
  return { id: s.user.id, username: s.user.username, name: s.user.name, role: s.user.role };
});

/** For pages: redirect to the login screen when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

/** For pages: redirect to the no-access screen when the role lacks the permission. */
export async function requirePerm(perm: Perm): Promise<SessionUser> {
  const u = await requireUser();
  if (!hasPerm(u.role, perm)) redirect(`/no-access?p=${encodeURIComponent(perm)}`);
  return u;
}

export class ActionError extends Error {}

/** For server actions and route handlers: throws ActionError instead of redirecting. */
export async function actionUser(perm?: Perm): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new ActionError("Your session has expired. Please sign in again.");
  if (perm && !hasPerm(u.role, perm)) throw new ActionError("You do not have permission for this action.");
  return u;
}

export function can(user: SessionUser | null, perm: Perm): boolean {
  return !!user && hasPerm(user.role, perm);
}
