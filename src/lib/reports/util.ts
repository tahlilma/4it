import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, addMonths, monthKey, parseDate, parseMonth, startOfMonth } from "../dates";
import { prisma } from "../db";
import { EMP_ORDER, employeeWhere, parseEmpFilter, str, type SP } from "../employee-filter";
import type { Filters, Group, ReportDef, Row } from "./types";

/** Latest day with processed attendance before today — the natural default for daily reports. */
export async function latestProcessedDay(today: Date): Promise<Date> {
  const r = await prisma.attendanceDay.aggregate({ where: { date: { lt: today } }, _max: { date: true } });
  return r._max.date ?? addDays(today, -1);
}

export function parseFilters(def: ReportDef, sp: SP, today: Date, lastProcessed?: Date): Filters {
  const cur = { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };
  const prevD = addMonths(startOfMonth(cur.year, cur.month), -1);
  const prev = { year: prevD.getUTCFullYear(), month: prevD.getUTCMonth() + 1 };
  const month = parseMonth(str(sp.month)) ?? (def.defaults?.month === "current" ? cur : prev);
  const m2D = addMonths(startOfMonth(month.year, month.month), -1);
  const month2 = parseMonth(str(sp.month2)) ?? { year: m2D.getUTCFullYear(), month: m2D.getUTCMonth() + 1 };
  const yesterday = lastProcessed ?? addDays(today, -1);
  const date = parseDate(str(sp.date)) ?? (def.defaults?.date === "today" ? today : yesterday);
  const from = parseDate(str(sp.from)) ?? startOfMonth(yesterday.getUTCFullYear(), yesterday.getUTCMonth() + 1);
  const to = parseDate(str(sp.to)) ?? yesterday;
  const n = (k: string) => {
    const v = Number(str(sp[k]));
    return Number.isInteger(v) && v > 0 ? v : undefined;
  };
  const emp = parseEmpFilter(sp);
  if (!emp.status && def.defaults?.status) emp.status = def.defaults.status;
  return {
    raw: sp,
    date,
    from,
    to: to < from ? from : to,
    month,
    month2,
    year: n("year") ?? today.getUTCFullYear(),
    emp,
    format: str(sp.format) || def.formats?.[0]?.value || "",
    buyer: n("buyer"),
    bonus: n("bonus"),
    elrun: n("elrun"),
    leaveType: n("leaveType"),
    team: n("team"),
    device: n("device"),
    minDays: n("minDays") ?? 0,
    letter: n("letter") ?? 1,
    address: str(sp.address) || "both",
    param: (k: string) => str(sp[k]),
    page: n("page") ?? 1,
    batchSize: def.batch ?? 0,
  };
}

/**
 * Limits a document report to the requested batch (see ReportDef.batch) and records which part is
 * shown, so the report page can offer the other batches.
 */
export function takeBatch<T>(f: Filters, list: T[]): T[] {
  const size = f.batchSize;
  if (!size || list.length <= size) return list;
  const pages = Math.ceil(list.length / size);
  const page = Math.min(Math.max(1, f.page), pages);
  const start = (page - 1) * size;
  f.paging = { total: list.length, size, page, pages, from: start + 1, to: Math.min(list.length, start + size) };
  return list.slice(start, start + size);
}

export const ORG_INCLUDE = {
  department: true,
  section: true,
  designation: true,
  grade: true,
  line: true,
  floor: true,
  machineType: true,
  shift: true,
} satisfies Prisma.EmployeeInclude;

export type EmpRow = Prisma.EmployeeGetPayload<{ include: typeof ORG_INCLUDE }>;

export async function loadEmployees(f: Filters, where: Prisma.EmployeeWhereInput = {}, defaultStatus: "ACTIVE" | "ALL" = "ACTIVE"): Promise<EmpRow[]> {
  return prisma.employee.findMany({
    where: { AND: [employeeWhere(f.emp, { defaultStatus }), where] },
    include: ORG_INCLUDE,
    orderBy: EMP_ORDER,
  });
}

export const secTitle = (e: { department: { nameEn: string }; section: { nameEn: string } }) => `${e.department.nameEn} › ${e.section.nameEn}`;

/** Group rows preserving first-seen order. */
export function groupBy<T>(items: T[], key: (t: T) => string, map: (t: T) => Row): Group[] {
  const groups = new Map<string, Row[]>();
  for (const it of items) {
    const k = key(it);
    const list = groups.get(k) ?? [];
    list.push(map(it));
    groups.set(k, list);
  }
  return [...groups.entries()].map(([title, rows]) => ({ title, rows }));
}

export const monthParam = (m: { year: number; month: number }) => monthKey(m.year, m.month);

export async function runFor(m: { year: number; month: number }) {
  return prisma.payrollRun.findUnique({ where: { year_month: { year: m.year, month: m.month } } });
}

/** Payslips of a month with employee and org snapshot, filtered by the employee filter. */
export async function payslipsFor(f: Filters, extra: Prisma.PayslipWhereInput = {}) {
  const run = await runFor(f.month);
  if (!run) return { run: null, slips: [] as Awaited<ReturnType<typeof loadSlips>> };
  return { run, slips: await loadSlips(run.id, f, extra) };
}

async function loadSlips(runId: number, f: Filters, extra: Prisma.PayslipWhereInput) {
  const ef = { ...f.emp };
  // Payslips already carry the org snapshot; filter on it rather than the employee's current unit.
  const where: Prisma.PayslipWhereInput = { runId, ...extra };
  if (ef.dept) where.departmentId = ef.dept;
  if (ef.sec) where.sectionId = ef.sec;
  if (ef.desig) where.designationId = ef.desig;
  if (ef.line) where.lineId = ef.line;
  if (ef.type) where.empType = ef.type;
  if (ef.pay) where.paymentMode = ef.pay;
  const empWhere: Prisma.EmployeeWhereInput = {};
  if (ef.gender) empWhere.gender = ef.gender;
  if (ef.religion) empWhere.religion = ef.religion;
  const codes = (ef.emp ?? "").split(/[\s,;]+/).filter(Boolean);
  if (codes.length) empWhere.empCode = { in: codes };
  if (Object.keys(empWhere).length) where.employee = empWhere;
  return prisma.payslip.findMany({
    where,
    include: { employee: true, department: true, section: true, designation: true, grade: true, line: true },
    orderBy: [{ department: { sortOrder: "asc" } }, { section: { sortOrder: "asc" } }, { employee: { empCode: "asc" } }],
  });
}

export type SlipRow = Awaited<ReturnType<typeof loadSlips>>[number];
