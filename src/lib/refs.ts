import "server-only";
import { prisma } from "./db";
import type { RefSource } from "./masters";

export interface RefOption {
  value: number;
  label: string;
  departmentId?: number;
}

/** Option lists for selects (departments, sections …). */
export async function refOptions(src: RefSource): Promise<RefOption[]> {
  switch (src) {
    case "departments":
      return (await prisma.department.findMany({ orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] })).map((d) => ({ value: d.id, label: d.nameEn }));
    case "sections":
      return (
        await prisma.section.findMany({ orderBy: [{ department: { sortOrder: "asc" } }, { sortOrder: "asc" }], include: { department: true } })
      ).map((s) => ({ value: s.id, label: `${s.department.nameEn} › ${s.nameEn}`, departmentId: s.departmentId }));
    case "floors":
      return (await prisma.floor.findMany({ orderBy: { sortOrder: "asc" } })).map((f) => ({ value: f.id, label: f.nameEn }));
    case "grades":
      return (await prisma.grade.findMany({ orderBy: { sortOrder: "asc" } })).map((g) => ({ value: g.id, label: `${g.nameEn}${g.minGross ? ` (min ${g.minGross})` : ""}` }));
    case "designations":
      return (await prisma.designation.findMany({ orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }] })).map((d) => ({ value: d.id, label: d.nameEn }));
    case "lines":
      return (await prisma.line.findMany({ orderBy: { sortOrder: "asc" } })).map((l) => ({ value: l.id, label: l.nameEn }));
  }
}

/** All option lists needed by employee filters and forms. */
export async function orgOptions() {
  const [departments, sections, designations, grades, lines, floors, machineTypes, shifts] = await Promise.all([
    refOptions("departments"),
    refOptions("sections"),
    refOptions("designations"),
    refOptions("grades"),
    refOptions("lines"),
    refOptions("floors"),
    prisma.machineType.findMany({ orderBy: { sortOrder: "asc" } }).then((r) => r.map((m) => ({ value: m.id, label: m.nameEn }))),
    prisma.shift.findMany({ where: { active: true }, orderBy: { code: "asc" } }).then((r) => r.map((s) => ({ value: s.id, label: s.name }))),
  ]);
  return { departments, sections, designations, grades, lines, floors, machineTypes, shifts };
}
