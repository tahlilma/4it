import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ActionError } from "./auth";

export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export class FieldErrors extends Error {
  constructor(public fields: Record<string, string>) {
    const msgs = [...new Set(Object.values(fields))];
    super(`Please correct the highlighted fields: ${msgs.slice(0, 3).join(" · ")}${msgs.length > 3 ? ` (+${msgs.length - 3} more)` : ""}`);
  }
}

/**
 * Wraps a server action body: converts permission / validation / unique-constraint errors into a
 * FormState the form can display, and lets Next.js redirects and not-found errors through.
 */
export async function runAction(fn: () => Promise<FormState | void>): Promise<FormState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof FieldErrors) return { ok: false, error: e.message, fieldErrors: e.fields };
    if (e instanceof ActionError) return { ok: false, error: e.message };
    const err = e as { code?: string; meta?: { target?: unknown }; message?: string };
    if (err?.code === "P2002") {
      return { ok: false, error: `This value already exists (${String(err.meta?.target ?? "unique field")}).` };
    }
    if (err?.code === "P2003") {
      return { ok: false, error: "This record is in use by other records and cannot be removed." };
    }
    console.error(e);
    return { ok: false, error: err?.message ? `Could not save: ${err.message}` : "Unexpected error." };
  }
}
