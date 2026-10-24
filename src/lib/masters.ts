// Configuration for the generic master-data screens (Setup → Master Data).

import { EMP_TYPES, GENDERS, HOLIDAY_TYPES, type Opt } from "./constants";

export type FieldType = "text" | "number" | "int" | "bool" | "select" | "ref" | "date" | "time" | "textarea";
export type RefSource = "departments" | "sections" | "floors" | "grades" | "designations" | "lines";

export interface MasterField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Opt[];
  ref?: RefSource;
  default?: string | number | boolean;
  list?: boolean; // show in the table
  hint?: string;
  bn?: boolean;
  allowBlank?: boolean; // for time fields
}

export interface MasterDef {
  key: string;
  model: string;
  title: string;
  singular: string;
  description: string;
  fields: MasterField[];
  orderBy: Record<string, "asc" | "desc">[];
  reprocessHint?: boolean;
}

const nameFields: MasterField[] = [
  { name: "nameEn", label: "Name (English)", type: "text", required: true, list: true },
  { name: "nameBn", label: "Name (Bangla)", type: "text", list: true, bn: true },
];
const sortActive: MasterField[] = [
  { name: "sortOrder", label: "Sort order", type: "int", default: 0 },
  { name: "active", label: "Active", type: "bool", default: true, list: true },
];

const ACCRUAL: Opt[] = [
  { value: "FIXED", en: "Fixed yearly (CL/SL)", bn: "" },
  { value: "EARNED", en: "Earned — 1 day per N days worked (EL)", bn: "" },
  { value: "NONE", en: "No balance (ML, LWP, compensatory)", bn: "" },
];

export const MASTERS: MasterDef[] = [
  {
    key: "departments", model: "department", title: "Departments", singular: "Department",
    description: "Top-level organisation units (e.g. Sewing, Cutting, Administration).",
    fields: [{ name: "code", label: "Code", type: "text", list: true }, ...nameFields, ...sortActive],
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  },
  {
    key: "sections", model: "section", title: "Sections", singular: "Section",
    description: "Sections within a department (e.g. Iron and Packing under Finishing).",
    fields: [{ name: "departmentId", label: "Department", type: "ref", ref: "departments", required: true, list: true }, ...nameFields, ...sortActive],
    orderBy: [{ departmentId: "asc" }, { sortOrder: "asc" }],
  },
  {
    key: "floors", model: "floor", title: "Floors", singular: "Floor",
    description: "Building floors — used for safety teams and line-wise reports.",
    fields: [...nameFields, ...sortActive],
    orderBy: [{ sortOrder: "asc" }],
  },
  {
    key: "lines", model: "line", title: "Production Lines", singular: "Line",
    description: "Sewing lines for line-wise attendance summaries.",
    fields: [...nameFields, { name: "floorId", label: "Floor", type: "ref", ref: "floors", list: true }, ...sortActive],
    orderBy: [{ sortOrder: "asc" }],
  },
  {
    key: "machine-types", model: "machineType", title: "Machine Types", singular: "Machine type",
    description: "Sewing machine types for machine-wise attendance summaries.",
    fields: [...nameFields, ...sortActive],
    orderBy: [{ sortOrder: "asc" }],
  },
  {
    key: "grades", model: "grade", title: "Grades & Minimum Wage", singular: "Grade",
    description: "Wage grades with the gazetted minimum. Employees below their grade minimum are flagged in the compliance monitor. Update after every wage-board gazette and annual increment.",
    fields: [
      { name: "code", label: "Code", type: "text", required: true, list: true },
      ...nameFields,
      { name: "empType", label: "Employee type", type: "select", options: EMP_TYPES, default: "WORKER", list: true },
      { name: "minGross", label: "Minimum gross (Tk)", type: "number", default: 0, list: true },
      { name: "basic", label: "Basic", type: "number", default: 0, list: true },
      { name: "houseRent", label: "House rent", type: "number", default: 0 },
      { name: "medical", label: "Medical", type: "number", default: 0 },
      { name: "transport", label: "Transport", type: "number", default: 0 },
      { name: "food", label: "Food", type: "number", default: 0 },
      ...sortActive,
    ],
    orderBy: [{ sortOrder: "asc" }],
  },
  {
    key: "designations", model: "designation", title: "Designations", singular: "Designation",
    description: "Job titles with their grade, OT eligibility and monthly attendance bonus.",
    fields: [
      ...nameFields,
      { name: "empType", label: "Employee type", type: "select", options: EMP_TYPES, default: "WORKER", list: true },
      { name: "gradeId", label: "Grade", type: "ref", ref: "grades", list: true },
      { name: "otEligible", label: "Overtime eligible", type: "bool", default: true, list: true },
      { name: "attendanceBonus", label: "Attendance bonus (Tk / month)", type: "number", default: 0, list: true },
      ...sortActive,
    ],
    orderBy: [{ sortOrder: "asc" }],
  },
  {
    key: "shifts", model: "shift", title: "Shifts & OT Rules", singular: "Shift",
    description: "Shift timings, grace periods and how overtime minutes are rounded into payable hours.",
    reprocessHint: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, list: true },
      { name: "name", label: "Name", type: "text", required: true, list: true },
      { name: "inTime", label: "In time", type: "time", required: true, list: true },
      { name: "outTime", label: "Out time", type: "time", required: true, list: true, hint: "Earlier than in-time means the shift ends next day." },
      { name: "lateGraceMin", label: "Late grace (min)", type: "int", default: 5, list: true },
      { name: "earlyGraceMin", label: "Early-out grace (min)", type: "int", default: 0 },
      { name: "breakMinutes", label: "Meal break (min)", type: "int", default: 60, hint: "s.101: 1 h after 6 h of work" },
      { name: "otStartAfterMin", label: "OT starts after shift end (min)", type: "int", default: 0 },
      { name: "otRoundUnitMin", label: "OT unit (min)", type: "int", default: 60, list: true },
      { name: "otRoundUpMin", label: "Round up when remainder ≥ (min)", type: "int", default: 50, list: true },
      { name: "tiffinAfter", label: "Tiffin bill if out at/after", type: "time", default: "19:30", allowBlank: true },
      { name: "nightAfter", label: "Night bill if out at/after", type: "time", default: "22:00", allowBlank: true },
      { name: "windowBeforeMin", label: "Punch window opens before in-time (min)", type: "int", default: 240 },
      { name: "active", label: "Active", type: "bool", default: true, list: true },
    ],
    orderBy: [{ code: "asc" }],
  },
  {
    key: "holidays", model: "holiday", title: "Holiday Calendar", singular: "Holiday",
    description: "Festival holidays (s.118: 11 days a year with full wages) and government holidays. Weekly holiday is set in Company & Policy.",
    reprocessHint: true,
    fields: [
      { name: "date", label: "Date", type: "date", required: true, list: true },
      ...nameFields,
      { name: "type", label: "Type", type: "select", options: HOLIDAY_TYPES, default: "FESTIVAL", list: true },
    ],
    orderBy: [{ date: "desc" }],
  },
  {
    key: "leave-types", model: "leaveType", title: "Leave Types", singular: "Leave type",
    description: "Statutory leave: casual 10 days (s.115), sick 14 days (s.116), earned 1 day per 18 days worked (s.117), maternity 16 weeks (s.46).",
    reprocessHint: true,
    fields: [
      { name: "code", label: "Code", type: "text", required: true, list: true },
      ...nameFields,
      { name: "annualDays", label: "Days per year", type: "number", default: 0, list: true },
      { name: "paid", label: "Paid in salary", type: "bool", default: true, list: true, hint: "Maternity leave is unpaid in salary because the benefit is paid separately." },
      { name: "accrual", label: "Balance rule", type: "select", options: ACCRUAL, default: "FIXED", list: true },
      { name: "proRata", label: "Pro-rata for joiners (r.106)", type: "bool", default: true },
      { name: "gender", label: "Only for", type: "select", options: GENDERS },
      { name: "sortOrder", label: "Sort order", type: "int", default: 0 },
      { name: "active", label: "Active", type: "bool", default: true, list: true },
    ],
    orderBy: [{ sortOrder: "asc" }],
  },
  {
    key: "teams", model: "team", title: "Safety Teams", singular: "Team",
    description: "Fire fighting, rescue and first-aid teams. Labour Rules r.55(10): at least 18 % of each division trained, each team at least 6 %.",
    fields: [
      { name: "code", label: "Code", type: "text", required: true, list: true },
      ...nameFields,
      { name: "requiredPercent", label: "Required % of each department", type: "number", default: 6, list: true },
      { name: "sortOrder", label: "Sort order", type: "int", default: 0 },
    ],
    orderBy: [{ sortOrder: "asc" }],
  },
  {
    key: "buyers", model: "buyer", title: "Buyers (Code of Conduct)", singular: "Buyer",
    description: "Buyer working-hour limits used to flag breaches on the buyer-format job card. Records are never altered to fit a limit.",
    fields: [
      { name: "name", label: "Buyer", type: "text", required: true, list: true },
      { name: "maxOtPerDay", label: "Max OT per day (h)", type: "number", default: 2, list: true },
      { name: "maxHoursPerWeek", label: "Max hours per week", type: "number", default: 60, list: true },
      { name: "maxConsecutiveDays", label: "Max consecutive working days", type: "int", default: 6, list: true },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "active", label: "Active", type: "bool", default: true, list: true },
    ],
    orderBy: [{ name: "asc" }],
  },
  {
    key: "devices", model: "device", title: "Punch Machines", singular: "Device",
    description: "ZKTeco-compatible attendance devices (TCP 4370). Sync from Attendance → Punch Machines.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, list: true },
      { name: "ip", label: "IP address", type: "text", required: true, list: true },
      { name: "port", label: "Port", type: "int", default: 4370, list: true },
      { name: "location", label: "Location", type: "text", list: true },
      { name: "serialNo", label: "Serial no.", type: "text" },
      { name: "active", label: "Active", type: "bool", default: true, list: true },
    ],
    orderBy: [{ name: "asc" }],
  },
  {
    key: "bank-accounts", model: "bankAccount", title: "Company Bank Accounts", singular: "Bank account",
    description: "Company accounts used on bank-advice letters for salary transfer.",
    fields: [
      { name: "bankName", label: "Bank", type: "text", required: true, list: true },
      { name: "branch", label: "Branch", type: "text", list: true },
      { name: "accountName", label: "Account name", type: "text" },
      { name: "accountNo", label: "Account no.", type: "text", list: true },
      { name: "routingNo", label: "Routing no.", type: "text" },
      { name: "address", label: "Branch address", type: "textarea" },
      { name: "active", label: "Active", type: "bool", default: true, list: true },
    ],
    orderBy: [{ bankName: "asc" }],
  },
  {
    key: "manpower", model: "manpowerBudget", title: "Manpower Requisition (Budget)", singular: "Requirement",
    description: "Approved manpower per department / section / designation / line, compared with actual headcount and daily attendance.",
    fields: [
      { name: "departmentId", label: "Department", type: "ref", ref: "departments", required: true, list: true },
      { name: "sectionId", label: "Section", type: "ref", ref: "sections", list: true },
      { name: "designationId", label: "Designation", type: "ref", ref: "designations", list: true },
      { name: "lineId", label: "Line", type: "ref", ref: "lines", list: true },
      { name: "required", label: "Required manpower", type: "int", required: true, list: true },
    ],
    orderBy: [{ departmentId: "asc" }, { sectionId: "asc" }],
  },
];

export function masterByKey(key: string): MasterDef | undefined {
  return MASTERS.find((m) => m.key === key);
}
