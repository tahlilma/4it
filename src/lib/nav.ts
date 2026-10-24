import type { IconName } from "@/components/icons";
import type { Hue } from "@/components/ui";
import { hasPerm, type Perm } from "./rbac";

export interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the mobile tab bar. */
  short?: string;
  icon: IconName;
  color: Hue;
  perm?: Perm;
  anyPerm?: Perm[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", short: "Home", icon: "home", color: "blue" },
      { href: "/compliance", label: "Compliance Monitor", icon: "shield", color: "green", perm: "compliance.view" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/employees", label: "Employees", short: "People", icon: "users", color: "orange", perm: "employee.view" },
      { href: "/employees/new", label: "New Employee", icon: "user-add", color: "orange", perm: "employee.edit" },
    ],
  },
  {
    label: "Attendance",
    items: [
      { href: "/attendance", label: "Daily Attendance", short: "Attendance", icon: "clock", color: "indigo", perm: "attendance.view" },
      { href: "/attendance/devices", label: "Punch Machines", icon: "device", color: "red", perm: "device.manage" },
      { href: "/attendance/import", label: "Import Punch Log", icon: "upload", color: "blue", perm: "attendance.edit" },
      { href: "/attendance/manual", label: "Manual Entry", icon: "edit", color: "yellow", perm: "attendance.edit" },
      { href: "/attendance/process", label: "Process Attendance", icon: "process", color: "teal", perm: "attendance.process" },
    ],
  },
  {
    label: "Leave",
    items: [{ href: "/leave", label: "Leave Applications", icon: "calendar", color: "purple", perm: "leave.view" }],
  },
  {
    label: "Payroll",
    items: [
      { href: "/payroll", label: "Salary Processing", short: "Payroll", icon: "cash", color: "green", perm: "payroll.view" },
      { href: "/payroll/adjustments", label: "Additions & Deductions", icon: "list", color: "gray", perm: "payroll.process" },
      { href: "/payroll/advances", label: "Advances", icon: "bank", color: "brown", perm: "payroll.process" },
      { href: "/payroll/bonus", label: "Festival Bonus", icon: "gift", color: "pink", perm: "bonus.manage" },
      { href: "/payroll/increments", label: "Increment & Promotion", icon: "trending", color: "mint", perm: "increment.propose" },
      { href: "/payroll/el-encashment", label: "EL Encashment", icon: "calendar", color: "cyan", perm: "payroll.process" },
    ],
  },
  {
    label: "Separation",
    items: [
      { href: "/separations", label: "Separation & Settlement", icon: "door", color: "red", perm: "separation.manage" },
      { href: "/separations/lefty", label: "Lefty (Absence) Cases", icon: "moon", color: "indigo", perm: "separation.manage" },
      { href: "/maternity", label: "Maternity Benefit", icon: "heart", color: "pink", perm: "leave.approve" },
    ],
  },
  {
    label: "Reports",
    items: [{ href: "/reports", label: "Report Center", short: "Reports", icon: "document", color: "blue", anyPerm: ["reports.hr", "reports.attendance", "reports.salary"] }],
  },
  {
    label: "Administration",
    items: [
      { href: "/setup/company", label: "Company & Policy", icon: "building", color: "gray", perm: "setup.manage" },
      { href: "/setup", label: "Master Data", icon: "layers", color: "gray", perm: "setup.manage" },
      { href: "/setup/users", label: "Users & Roles", icon: "user-circle", color: "gray", perm: "users.manage" },
      { href: "/audit", label: "Audit Log", icon: "lock", color: "gray", perm: "audit.view" },
    ],
  },
  {
    label: "Help",
    items: [{ href: "/help", label: "Help & Guide", icon: "book", color: "blue" }],
  },
];

export function navFor(role: string): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (i.perm ? hasPerm(role, i.perm) : i.anyPerm ? i.anyPerm.some((p) => hasPerm(role, p)) : true)),
  })).filter((g) => g.items.length > 0);
}

/** Destinations for the mobile tab bar, in order, limited to what the role can open. */
export const TAB_HREFS = ["/", "/employees", "/attendance", "/payroll", "/reports"];

/** Which nav item a pathname belongs to: the most specific prefix wins. */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const h of hrefs) {
    const hit = h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/");
    if (hit && (!best || h.length > best.length)) best = h;
  }
  return best;
}
