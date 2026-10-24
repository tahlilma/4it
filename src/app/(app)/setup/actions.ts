"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { runAction, type FormState } from "@/lib/action";
import { audit, diff } from "@/lib/audit";
import { actionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseFields } from "@/lib/form-parse";
import { masterByKey, type MasterDef } from "@/lib/masters";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Delegate = { create: (a: any) => Promise<any>; update: (a: any) => Promise<any>; delete: (a: any) => Promise<any>; findUnique: (a: any) => Promise<any> };
const delegate = (def: MasterDef) => (prisma as unknown as Record<string, Delegate>)[def.model];

export async function saveMaster(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("setup.manage");
    const def = masterByKey(String(fd.get("_master") ?? ""));
    if (!def) return { ok: false, error: "Unknown master." };
    const id = Number(fd.get("_id") ?? 0);
    const data = parseFields(def.fields, fd);
    const d = delegate(def);
    if (id) {
      const before = await d.findUnique({ where: { id } });
      await d.update({ where: { id }, data });
      await audit(user, "UPDATE", def.singular, id, `Updated ${def.singular.toLowerCase()}`, diff(before, data));
      redirect(`/setup/${def.key}?saved=1`);
    }
    const row = await d.create({ data });
    await audit(user, "CREATE", def.singular, row.id, `Created ${def.singular.toLowerCase()}`, data);
    refresh();
    return { ok: true, message: `${def.singular} saved.${def.reprocessHint ? " Re-process attendance for affected dates." : ""}` };
  });
}

export async function deleteMaster(_prev: FormState | null, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await actionUser("setup.manage");
    const def = masterByKey(String(fd.get("_master") ?? ""));
    if (!def) return { ok: false, error: "Unknown master." };
    const id = Number(fd.get("_id"));
    const d = delegate(def);
    const before = await d.findUnique({ where: { id } });
    await d.delete({ where: { id } });
    await audit(user, "DELETE", def.singular, id, `Deleted ${def.singular.toLowerCase()}`, before ?? undefined);
    refresh();
    return { ok: true, message: "Deleted." };
  });
}
