// Role-based access control. Permissions are checked on every page, server action and route handler.

export const PERMS = [
  "employee.view",
  "employee.edit",
  "salary.view",
  "salary.edit",
  "attendance.view",
  "attendance.edit",
  "attendance.process",
  "device.manage",
  "leave.view",
  "leave.edit",
  "leave.approve",
  "payroll.view",
  "payroll.process",
  "payroll.lock",
  "bonus.manage",
  "increment.propose",
  "increment.approve",
  "separation.manage",
  "settlement.approve",
  "reports.hr",
  "reports.attendance",
  "reports.salary",
  "compliance.view",
  "setup.manage",
  "users.manage",
  "audit.view",
] as const;

export type Perm = (typeof PERMS)[number];

const all = new Set<Perm>(PERMS);
const set = (...p: Perm[]) => new Set<Perm>(p);

export const ROLE_PERMS: Record<string, Set<Perm>> = {
  ADMIN: all,
  HR_MANAGER: new Set(PERMS.filter((p) => p !== "users.manage")),
  HR_OFFICER: set(
    "employee.view", "employee.edit", "salary.view",
    "attendance.view", "attendance.edit", "attendance.process", "device.manage",
    "leave.view", "leave.edit", "leave.approve",
    "increment.propose", "separation.manage",
    "reports.hr", "reports.attendance", "compliance.view",
  ),
  PAYROLL: set(
    "employee.view", "salary.view", "salary.edit",
    "attendance.view", "leave.view",
    "payroll.view", "payroll.process", "bonus.manage", "increment.propose",
    "separation.manage", "settlement.approve",
    "reports.hr", "reports.attendance", "reports.salary", "compliance.view",
  ),
  TIMEKEEPER: set(
    "employee.view", "attendance.view", "attendance.edit", "attendance.process", "device.manage",
    "leave.view", "leave.edit", "reports.attendance",
  ),
  VIEWER: set("employee.view", "attendance.view", "leave.view", "reports.hr", "reports.attendance", "compliance.view"),
};

export function hasPerm(role: string | null | undefined, perm: Perm): boolean {
  if (!role) return false;
  return ROLE_PERMS[role]?.has(perm) ?? false;
}

export function permsOf(role: string): Perm[] {
  return [...(ROLE_PERMS[role] ?? [])];
}
