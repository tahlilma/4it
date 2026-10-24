import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DIR = path.join(process.cwd(), "data", "uploads", "photos");

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const emp = await prisma.employee.findUnique({ where: { id: Number(id) }, select: { photoPath: true } });
  if (!emp?.photoPath || emp.photoPath.includes("/") || emp.photoPath.includes("\\")) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(DIR, emp.photoPath));
    const type = emp.photoPath.endsWith(".png") ? "image/png" : emp.photoPath.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=300" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
