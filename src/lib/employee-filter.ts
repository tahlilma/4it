// Employee filters shared by the employee list and the reports.

import type { Prisma } from "@/generated/prisma/client";

export type SP = Record<string, string | string[] | undefined>;

export interface EmpFilter {
  q?: string;
  emp?: string; // comma / space separated employee codes
  dept?: number;
  sec?: number;
  desig?: number;
  line?: number;
  floor?: number;
  grade?: number;
  mtype?: number;
  type?: string;
  gender?: string;
  religion?: string;
  pay?: string;
  status?: string; // ACTIVE (default) | SEPARATED | ALL
}

export const str = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "").trim();
const num = (v: string | string[] | undefined): number | undefined => {
  const s = str(v);
  const n = Number(s);
  return s && Number.isInteger(n) && n > 0 ? n : undefined;
};

export function parseEmpFilter(sp: SP): EmpFilter {
  return {
    q: str(sp.q) || undefined,
    emp: str(sp.emp) || undefined,
    dept: num(sp.dept),
    sec: num(sp.sec),
    desig: num(sp.desig),
    line: num(sp.line),
    floor: num(sp.floor),
    grade: num(sp.grade),
    mtype: num(sp.mtype),
    type: str(sp.type) || undefined,
    gender: str(sp.gender) || undefined,
    religion: str(sp.religion) || undefined,
    pay: str(sp.pay) || undefined,
    status: str(sp.status) || undefined,
  };
}

export function empCodes(s: string | undefined): string[] {
  return (s ?? "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
}

export function employeeWhere(f: EmpFilter, opts: { defaultStatus?: "ACTIVE" | "ALL" } = {}): Prisma.EmployeeWhereInput {
  const w: Prisma.EmployeeWhereInput = {};
  if (f.dept) w.departmentId = f.dept;
  if (f.sec) w.sectionId = f.sec;
  if (f.desig) w.designationId = f.desig;
  if (f.line) w.lineId = f.line;
  if (f.floor) w.floorId = f.floor;
  if (f.grade) w.gradeId = f.grade;
  if (f.mtype) w.machineTypeId = f.mtype;
  if (f.type) w.empType = f.type;
  if (f.gender) w.gender = f.gender;
  if (f.religion) w.religion = f.religion;
  if (f.pay) w.paymentMode = f.pay;
  const status = f.status ?? (opts.defaultStatus === "ALL" ? "ALL" : "ACTIVE");
  if (status !== "ALL") w.status = status;
  const codes = empCodes(f.emp);
  if (codes.length) w.empCode = { in: codes };
  if (f.q) {
    const q = f.q;
    w.OR = [{ empCode: { contains: q } }, { nameEn: { contains: q } }, { nameBn: { contains: q } }, { nidNo: { contains: q } }, { mobile: { contains: q } }];
  }
  return w;
}

/** Order used by every list and register: department, section, then ID. */
export const EMP_ORDER: Prisma.EmployeeOrderByWithRelationInput[] = [
  { department: { sortOrder: "asc" } },
  { section: { sortOrder: "asc" } },
  { empCode: "asc" },
];

export function qs(sp: SP, patch: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = str(v);
    if (s) u.set(k, s);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === "") u.delete(k);
    else u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}
