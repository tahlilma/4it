import type { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { todayLocal, ymd } from "@/lib/dates";
import { hasPerm } from "@/lib/rbac";
import { toXlsx } from "@/lib/reports/excel";
import { reportBySlug } from "@/lib/reports/registry";
import { latestProcessedDay, parseFilters } from "@/lib/reports/util";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { slug } = await ctx.params;
  const def = reportBySlug(slug);
  if (!def) return new Response("Unknown report", { status: 404 });
  if (!hasPerm(user.role, def.perm)) return new Response("Forbidden", { status: 403 });
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const sp: Record<string, string> = Object.fromEntries(req.nextUrl.searchParams.entries());
  const out = await def.run(parseFilters(def, sp, today, await latestProcessedDay(today)), { company, user, today });
  if (!out.table) return new Response("This report is a printed document — use Print / PDF instead.", { status: 400 });
  const buf = await toXlsx(out, company);
  await audit(user, "EXPORT", "Report", slug, `Exported ${def.title} to Excel`);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}-${ymd(today)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
