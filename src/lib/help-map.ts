/** Which Help & Guide topic explains a screen. Kept free of imports so client components can use it. */
const MAP: [string, string][] = [
  ["/payroll/bonus", "bonus-increments"],
  ["/payroll/increments", "bonus-increments"],
  ["/payroll/el-encashment", "bonus-increments"],
  ["/payroll", "payroll"],
  ["/employees", "employees"],
  ["/attendance", "attendance"],
  ["/leave", "leave"],
  ["/separations", "separation"],
  ["/maternity", "separation"],
  ["/compliance", "compliance"],
  ["/reports", "reports"],
  ["/setup", "administration"],
  ["/audit", "administration"],
  ["/account", "getting-started"],
];

export function helpTopicFor(pathname: string): string | null {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/help")) return null;
  for (const [prefix, slug] of MAP) if (pathname === prefix || pathname.startsWith(prefix + "/")) return slug;
  return "getting-started";
}
