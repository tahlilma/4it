import type { Perm } from "./rbac";

/** What each permission lets a person do, in plain words. */
export const PERM_LABELS: Record<Perm, string> = {
  "employee.view": "See employee files",
  "employee.edit": "Add and edit employees",
  "salary.view": "See salaries",
  "salary.edit": "Change salaries directly",
  "attendance.view": "See attendance",
  "attendance.edit": "Correct attendance (manual entries, punch-log imports)",
  "attendance.process": "Process attendance",
  "device.manage": "Manage punch machines",
  "leave.view": "See leave",
  "leave.edit": "Enter leave applications",
  "leave.approve": "Approve leave and maternity cases",
  "payroll.view": "See payroll",
  "payroll.process": "Process payroll, advances, additions & deductions, EL encashment",
  "payroll.lock": "Lock or unlock payroll, lock bonus sheets, post encashments",
  "bonus.manage": "Prepare festival bonus sheets",
  "increment.propose": "Propose increments and promotions",
  "increment.approve": "Approve increments",
  "separation.manage": "Record separations and lefty cases",
  "settlement.approve": "Approve final settlements",
  "reports.hr": "HR reports and letters",
  "reports.attendance": "Attendance reports",
  "reports.salary": "Salary and bonus reports",
  "compliance.view": "Compliance Monitor",
  "setup.manage": "Company policy and master data",
  "users.manage": "Users and roles",
  "audit.view": "Audit log",
};

/** One-line description of who each role is for. */
export const ROLE_BLURBS: Record<string, string> = {
  ADMIN: "Everything, including users and roles. Usually the HR head or the IT person who set the system up.",
  HR_MANAGER: "Everything except managing users — approves, locks and oversees compliance.",
  HR_OFFICER: "Day-to-day HR: employee files, attendance, leave, separations and HR / attendance reports.",
  PAYROLL: "Accounts: salaries, payroll processing, bonuses, advances, settlements and salary reports.",
  TIMEKEEPER: "Attendance desk: punch machines, imports, manual entries, processing and leave entry.",
  VIEWER: "Read-only — for auditors, buyers' compliance teams or management who only need to look.",
};
