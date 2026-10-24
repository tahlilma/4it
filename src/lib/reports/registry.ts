import { attendanceReports } from "./defs/attendance";
import { documentReports } from "./defs/documents";
import { employeeReports } from "./defs/employee";
import { leaveReports } from "./defs/leave";
import { payrollReports } from "./defs/payroll";
import type { ReportDef } from "./types";

// Catalog order follows the product's report list; statutory extras follow each group.
const ORDER = [
  // Personal file
  "job-application", "appointment-letter", "fitness-certificate", "nominee-form", "id-card", "confirmation-letter", "lefty-letter",
  "lefty-envelope", "show-cause", "service-book", "final-settlement", "leave-application", "maternity-benefit",
  // Leave
  "el-encashment", "leave-register", "leave-details", "leave-balances",
  // Increment
  "increment-proposals", "increment-list", "increment-letter",
  // Employee
  "all-employees", "employee-details", "new-employees", "dropouts", "manpower-requisition", "dept-summary", "type-summary", "designation-grade",
  "gender-summary", "religion-summary", "salary-history", "salary-structure", "safety-teams", "device-due", "device-delete", "worker-register", "biometric-export",
  // Attendance
  "attendance-register", "job-card", "daily-summary", "daily-summary-requirement", "daily-absent", "daily-present", "daily-status", "single-punch",
  "early-out", "late", "absent-counseling", "ot-summary", "day-salary-ot", "summary-line", "summary-designation", "summary-machine", "ot-register", "working-hours",
  // Bills
  "tiffin-bill", "tiffin-summary", "night-bill", "night-summary",
  // Payroll
  "salary-sheet", "pay-slip", "salary-summary", "salary-summary-status", "salary-summary-type", "only-salary", "only-ot", "salary-two-hour-ot", "extra-ot",
  "holiday-sheet", "bank-sheet", "bonus-sheet", "bonus-summary", "compare-salary",
];

const ALL: ReportDef[] = [...documentReports, ...leaveReports, ...employeeReports, ...attendanceReports, ...payrollReports];

export const REPORTS: ReportDef[] = [...ALL].sort((a, b) => {
  const ia = ORDER.indexOf(a.slug), ib = ORDER.indexOf(b.slug);
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
});

export const REPORT_GROUPS = ["Personal File", "Leave", "Increment", "Employee", "Attendance", "Bills", "Payroll"];

export function reportBySlug(slug: string): ReportDef | undefined {
  return REPORTS.find((r) => r.slug === slug);
}

/** Reports that implement a form prescribed by the Bangladesh Labour Rules 2015. */
export const STATUTORY: Record<string, string> = {
  "id-card": "Form 6",
  "service-book": "Form 7",
  "worker-register": "Form 8",
  "leave-register": "Form 9",
  "fitness-certificate": "Form 15",
  "ot-register": "Form 34",
  "salary-sheet": "Form 38",
  "pay-slip": "Form 38",
  "nominee-form": "Form 41",
  "appointment-letter": "Rule 19",
  "lefty-letter": "s.27(3A)",
  "show-cause": "s.24",
  "safety-teams": "Rule 55",
  "maternity-benefit": "s.45–50",
};
