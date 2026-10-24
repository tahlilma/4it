// Company profile and payroll policy form definition, with the statutory basis of each default.

import { WEEKDAY_OPTS, type Opt } from "./constants";
import type { MasterField } from "./masters";

const BASIS: Opt[] = [
  { value: "BASIC", en: "Basic", bn: "" },
  { value: "GROSS", en: "Gross", bn: "" },
];

export interface PolicySection {
  title: string;
  note?: string;
  fields: MasterField[];
}

export const POLICY_SECTIONS: PolicySection[] = [
  {
    title: "Company profile",
    note: "Printed on every report, letter, ID card and statutory form.",
    fields: [
      { name: "nameEn", label: "Company name (English)", type: "text", required: true },
      { name: "nameBn", label: "Company name (Bangla)", type: "text", bn: true },
      { name: "addressEn", label: "Address (English)", type: "text" },
      { name: "addressBn", label: "Address (Bangla)", type: "text", bn: true },
      { name: "phone", label: "Phone", type: "text" },
      { name: "email", label: "Email", type: "text" },
      { name: "licenseNo", label: "Factory licence / registration no.", type: "text" },
      { name: "bgmeaRegNo", label: "BGMEA membership no.", type: "text" },
      { name: "bkmeaRegNo", label: "BKMEA membership no.", type: "text" },
      { name: "hrHeadName", label: "HR head (signatory)", type: "text" },
      { name: "hrHeadDesignation", label: "HR head designation", type: "text" },
    ],
  },
  {
    title: "Salary structure",
    note: "RMG gazette pattern: gross = basic + house rent (50 % of basic) + medical + transport + food. 2023 gazette: medical 750, transport 450, food 1,250.",
    fields: [
      { name: "houseRentPercent", label: "House rent (% of basic)", type: "number", required: true },
      { name: "medicalAllowance", label: "Medical allowance (Tk)", type: "number", required: true },
      { name: "transportAllowance", label: "Transport allowance (Tk)", type: "number", required: true },
      { name: "foodAllowance", label: "Food allowance (Tk)", type: "number", required: true },
    ],
  },
  {
    title: "Working hours",
    note: "s.100: 8 h a day; s.102: 48 h a week, 60 h including overtime; s.103: one weekly holiday; s.108: OT at twice the ordinary rate.",
    fields: [
      { name: "weeklyHoliday", label: "Weekly holiday", type: "select", options: WEEKDAY_OPTS, required: true },
      { name: "dailyOtLimit", label: "Daily OT limit (h)", type: "number", required: true },
      { name: "dailyHoursLimit", label: "Daily working-hour limit (h)", type: "number", required: true },
      { name: "weeklyHoursLimit", label: "Weekly working-hour limit (h)", type: "number", required: true },
      { name: "holidayWorkAsOt", label: "Hours worked on weekly / festival holidays are overtime", type: "bool" },
      { name: "singlePunchPresent", label: "Count a single punch as present (no OT)", type: "bool" },
    ],
  },
  {
    title: "Overtime rate",
    note: "Rule 102: hourly OT = (basic × 2) ÷ 208, where 208 = 52 ÷ 12 × 48.",
    fields: [
      { name: "otDivisor", label: "Monthly hours divisor", type: "number", required: true },
      { name: "otMultiplier", label: "Multiplier", type: "number", required: true, hint: "Must be at least 2 (s.108)." },
    ],
  },
  {
    title: "Deductions",
    note: "s.125–126: only lawful deductions. Absence is deducted proportionately; revenue stamp per Rule 111(1).",
    fields: [
      { name: "absentBasis", label: "Absence deducted on", type: "select", options: BASIS, required: true },
      { name: "absentDivisor", label: "Absence divisor", type: "select", options: [{ value: "30", en: "30 days", bn: "" }, { value: "MONTH_DAYS", en: "Days in month", bn: "" }], required: true },
      { name: "stampCash", label: "Revenue stamp — cash payment (Tk)", type: "number" },
      { name: "stampBank", label: "Revenue stamp — bank / MFS (Tk)", type: "number" },
    ],
  },
  {
    title: "Attendance bonus & holiday duty",
    fields: [
      { name: "attBonusMaxLate", label: "Attendance bonus: max late days", type: "int" },
      { name: "attBonusAllowLeave", label: "Attendance bonus still paid when on approved leave", type: "bool" },
      { name: "holidayAllowBasis", label: "Holiday-duty allowance for non-OT staff (per day = basis ÷ 30)", type: "select", options: [...BASIS, { value: "NONE", en: "Not paid", bn: "" }], required: true },
    ],
  },
  {
    title: "Tiffin & night bills",
    note: "Paid per qualifying day based on the out-punch (thresholds are set per shift).",
    fields: [
      { name: "tiffinWorker", label: "Tiffin — workers (Tk)", type: "number" },
      { name: "tiffinStaff", label: "Tiffin — staff (Tk)", type: "number" },
      { name: "nightWorker", label: "Night bill — workers (Tk)", type: "number" },
      { name: "nightStaff", label: "Night bill — staff (Tk)", type: "number" },
    ],
  },
  {
    title: "Earned leave",
    note: "s.117: 1 day per 18 days worked after one year's service; r.107(2): encash at most half the balance once a year; s.11: unavailed leave paid on separation.",
    fields: [
      { name: "elDaysPerAccrual", label: "Days worked per 1 day EL", type: "number", required: true },
      { name: "elMaxBalance", label: "Maximum balance (days, 0 = no cap)", type: "number" },
      { name: "elEligibleMonths", label: "Qualifying service (months)", type: "int" },
      { name: "elEncashMaxPercent", label: "Annual encashment (% of balance)", type: "number" },
      { name: "elRateBasis", label: "EL encashment rate basis (÷ 30)", type: "select", options: BASIS, required: true },
    ],
  },
  {
    title: "Employment rules",
    note: "s.4: probation 3 months (workers) / 6 months (clerical); s.34: no child under 14; RMG gazette: 5 % yearly increment on basic; s.123: wages within 7 working days; s.30: dues within 30 working days; s.27(3A): 10 days' unauthorised absence.",
    fields: [
      { name: "minHiringAge", label: "Minimum hiring age", type: "int", required: true },
      { name: "probationWorkerMonths", label: "Probation — workers (months)", type: "int" },
      { name: "probationStaffMonths", label: "Probation — staff (months)", type: "int" },
      { name: "incrementPercent", label: "Annual increment (% of basic)", type: "number" },
      { name: "serviceBenefitBasis", label: "Service benefit / compensation basis", type: "select", options: BASIS, required: true },
      { name: "wageDueWorkingDays", label: "Wage payment deadline (working days)", type: "int" },
      { name: "settlementDueWorkingDays", label: "Final settlement deadline (working days)", type: "int" },
      { name: "leftyAbsentDays", label: "Unauthorised absence before lefty notice (days)", type: "int" },
      { name: "tzOffsetMinutes", label: "Timezone offset (minutes, Dhaka = 360)", type: "int" },
    ],
  },
];

export const POLICY_FIELDS: MasterField[] = POLICY_SECTIONS.flatMap((s) => s.fields);
