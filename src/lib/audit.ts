import "server-only";
import { clientInfo, type SessionUser } from "./auth";
import { prisma } from "./db";

type Change = [unknown, unknown];

const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined ? null : v);

/** Field-level differences between two records (only keys present in `after`). */
export function diff(before: object | null | undefined, after: object, keys?: string[]): Record<string, Change> {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const out: Record<string, Change> = {};
  for (const k of keys ?? Object.keys(a)) {
    const x = norm(b[k]);
    const y = norm(a[k]);
    if (JSON.stringify(x) !== JSON.stringify(y)) out[k] = [x, y];
  }
  return out;
}

/**
 * Append an audit record. Every create / update / delete / process / lock on HR, attendance and
 * payroll data is written here so that auditors can trace who changed what and when.
 */
export async function audit(
  user: SessionUser | null,
  action: string,
  entity: string,
  entityId: string | number,
  summary: string,
  changes?: Record<string, unknown> | null,
): Promise<void> {
  let ip = "";
  try {
    ip = (await clientInfo()).ip;
  } catch {
    // outside a request (scripts)
  }
  await prisma.auditLog.create({
    data: {
      userId: user?.id ?? null,
      userName: user?.username ?? "system",
      action,
      entity,
      entityId: String(entityId),
      summary: summary.slice(0, 500),
      changes: changes && Object.keys(changes).length ? JSON.stringify(changes).slice(0, 20000) : "",
      ip,
    },
  });
}
