"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action";
import { login, logout } from "@/lib/auth";

export async function loginAction(_prev: FormState | null, fd: FormData): Promise<FormState> {
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!username || !password) return { ok: false, error: "Enter your username and password." };
  const r = await login(username, password);
  if (!r.ok) return { ok: false, error: r.error };
  const next = String(fd.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}
