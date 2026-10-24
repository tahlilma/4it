import { CompanyHeader, Sheet, Signatures } from "@/components/report/sheet";
import { bn, bnMoney, bnMonthLabel, bnTakaWords } from "../../bangla";
import { label, PAYMENT_MODES, PAYSLIP_CATEGORIES, SEPARATION_TYPES } from "../../constants";
import { dmy, endOfMonth, monthLabel, startOfMonth } from "../../dates";
import { prisma } from "../../db";
import { employeeWhere } from "../../employee-filter";
import { enTakaWords } from "../../bangla";
import { money, round2, roundTk } from "../../num";
import { leaveBalances } from "../../services/leave";
import { elEncashable } from "../../engine/leave";
import { monthsBetween } from "../../dates";
import type { Col, Filters, ReportDef, ReportOutput, Row } from "../types";
import { groupBy, payslipsFor, type SlipRow, takeBatch } from "../util";

const PAY_FILTERS = ["month", "emp", "org", "type", "pay"] as const;
const slipSec = (s: SlipRow) => `${s.department.nameEn} › ${s.section.nameEn}`;
const noRun = (f: Filters): ReportOutput => ({ title: "Payroll not processed", empty: `Payroll for ${monthLabel(f.month.year, f.month.month)} has not been processed yet.` });
const statusNote = (status: string) => (status === "LOCKED" ? "Locked (paid)" : status === "PROCESSED" ? "Processed — not yet locked" : "Draft");
const others = (s: SlipRow) => round2(s.holidayAllowance + s.arrear + s.otherAddition);

function proRated(s: SlipRow) {
  const f = s.gross ? s.earnedGross / s.gross : 0;
  const basic = round2(s.basic * f), hr = round2(s.houseRent * f), med = round2(s.medical * f), tr = round2(s.transport * f);
  const food = round2(s.earnedGross - basic - hr - med - tr);
  return { basic, hr, med, tr, food };
}

function sumBy<T>(list: T[], pick: (t: T) => number) {
  return round2(list.reduce((s, t) => s + pick(t), 0));
}

function slipSummaryRow(list: SlipRow[]): Row {
  return {
    n: list.length,
    gross: sumBy(list, (s) => s.gross),
    earned: sumBy(list, (s) => s.earnedGross),
    absent: sumBy(list, (s) => s.absentDeduction),
    otH: sumBy(list, (s) => s.otHours),
    ot: sumBy(list, (s) => s.otAmount),
    bonus: sumBy(list, (s) => s.attendanceBonus),
    other: sumBy(list, others),
    payable: sumBy(list, (s) => s.grossPayable),
    ded: sumBy(list, (s) => s.totalDeduction),
    net: sumBy(list, (s) => s.netPayable),
  };
}

const SUMMARY_COLS: Col[] = [
  { key: "n", label: "Employees", fmt: "int", total: true },
  { key: "gross", label: "Gross salary", fmt: "money0", total: true },
  { key: "earned", label: "Earned", fmt: "money0", total: true },
  { key: "absent", label: "Absent ded.", fmt: "money0", total: true },
  { key: "otH", label: "OT hours", fmt: "hours", total: true },
  { key: "ot", label: "OT amount", fmt: "money0", total: true },
  { key: "bonus", label: "Att. bonus", fmt: "money0", total: true },
  { key: "other", label: "Other add.", fmt: "money0", total: true },
  { key: "payable", label: "Gross payable", fmt: "money0", total: true },
  { key: "ded", label: "Deductions", fmt: "money0", total: true },
  { key: "net", label: "Net pay", fmt: "money0", total: true },
];

function rollup(list: SlipRow[], key: (s: SlipRow) => string): Row[] {
  const m = new Map<string, SlipRow[]>();
  for (const s of list) m.set(key(s), [...(m.get(key(s)) ?? []), s]);
  return [...m.entries()].map(([unit, l]) => ({ unit, ...slipSummaryRow(l) }));
}

export const payrollReports: ReportDef[] = [
  {
    slug: "salary-sheet",
    group: "Payroll",
    title: "Salary Sheet (Actual & Compliance)",
    description: "Monthly wage sheet. The statutory format is the Form 38 register of wages (Rule 111). Both formats show the same, complete payment — including all overtime.",
    perm: "reports.salary",
    filters: ["format", ...PAY_FILTERS],
    formats: [
      { value: "detailed", label: "Detailed salary sheet" },
      { value: "statutory", label: "Register of wages — Form 38" },
    ],
    async run(f, { company }) {
      const { run, slips } = await payslipsFor(f);
      if (!run) return noRun(f);
      if (f.format === "statutory") {
        return {
          title: "Register of Wages — Form 38",
          titleBn: "মজুরী রেজিস্টার — ফরম ৩৮ (বিধি ১১১)",
          subtitle: `Wage period ${dmy(startOfMonth(run.year, run.month))} – ${dmy(endOfMonth(run.year, run.month))} · Registration no. ${company.licenseNo || "—"} · ${statusNote(run.status)}`,
          layout: "legall",
          table: {
            serial: true,
            subtotals: true,
            columns: [
              { key: "code", label: "Card no." }, { key: "name", label: "Name" }, { key: "basic", label: "Main wages", fmt: "money0", total: true },
              { key: "hr", label: "House rent", fmt: "money0", total: true }, { key: "tr", label: "Transport", fmt: "money0", total: true },
              { key: "med", label: "Medical", fmt: "money0", total: true }, { key: "food", label: "Food", fmt: "money0", total: true },
              { key: "bonus", label: "Attendance bonus", fmt: "money0", total: true }, { key: "otH", label: "OT hours", fmt: "hours", total: true },
              { key: "rate", label: "OT rate", fmt: "money" }, { key: "ot", label: "OT allowance", fmt: "money0", total: true },
              { key: "others", label: "Others", fmt: "money0", total: true }, { key: "total", label: "Total", fmt: "money0", total: true },
              { key: "ded", label: "Deduction", fmt: "money0", total: true }, { key: "net", label: "Total payable", fmt: "money0", total: true },
              { key: "sign", label: "Signature / revenue stamp" },
            ],
            groups: groupBy(slips, slipSec, (s) => {
              const p = proRated(s);
              const total = round2(s.earnedGross + s.attendanceBonus + s.otAmount + others(s));
              return {
                code: s.employee.empCode, name: s.employee.nameEn, basic: p.basic, hr: p.hr, tr: p.tr, med: p.med, food: p.food, bonus: s.attendanceBonus,
                otH: s.otHours, rate: s.otRate || "", ot: s.otAmount, others: others(s), total, ded: round2(s.absentDeduction + s.totalDeduction), net: s.netPayable, sign: "",
              };
            }),
          },
          signatures: ["Prepared by", "Checked by (Accounts)", "Manager (HR & Compliance)", "Authorised signatory"],
        };
      }
      return {
        title: "Salary Sheet",
        subtitle: `${monthLabel(run.year, run.month)} · ${slips.length} employees · ${statusNote(run.status)}`,
        layout: "legall",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "grade", label: "Gr." },
            { key: "join", label: "Joined", fmt: "date" }, { key: "gross", label: "Gross", fmt: "money0", total: true }, { key: "basic", label: "Basic", fmt: "money0" },
            { key: "pd", label: "Present", fmt: "int" }, { key: "lv", label: "Leave", fmt: "num" }, { key: "off", label: "W/H", fmt: "int" }, { key: "ab", label: "Absent", fmt: "int" },
            { key: "days", label: "Paid days", fmt: "num" }, { key: "earned", label: "Earned", fmt: "money0", total: true }, { key: "abd", label: "Absent ded.", fmt: "money0", total: true },
            { key: "otH", label: "OT h", fmt: "hours", total: true }, { key: "rate", label: "OT rate", fmt: "money" }, { key: "ot", label: "OT amt", fmt: "money0", total: true },
            { key: "bonus", label: "Att. bonus", fmt: "money0", total: true }, { key: "others", label: "Others", fmt: "money0", total: true },
            { key: "payable", label: "Gross payable", fmt: "money0", total: true }, { key: "adv", label: "Advance", fmt: "money0", total: true },
            { key: "stamp", label: "Stamp", fmt: "money0", total: true }, { key: "tax", label: "Tax / other", fmt: "money0", total: true },
            { key: "net", label: "Net pay", fmt: "money0", total: true }, { key: "sign", label: "Signature" },
          ],
          groups: groupBy(slips, slipSec, (s) => ({
            code: s.employee.empCode, name: s.employee.nameEn, desig: s.designation.nameEn, grade: s.grade?.code ?? "", join: s.employee.joinDate,
            gross: s.gross, basic: s.basic, pd: s.presentDays, lv: s.paidLeaveDays + s.unpaidLeaveDays, off: s.weekendDays + s.holidayDays - s.holidayWorkDays,
            ab: s.absentDays, days: s.payableDays, earned: s.earnedGross, abd: s.absentDeduction, otH: s.otHours, rate: s.otRate || "", ot: s.otAmount,
            bonus: s.attendanceBonus, others: others(s), payable: s.grossPayable, adv: s.advanceDeduction, stamp: s.stamp, tax: round2(s.tax + s.otherDeduction),
            net: s.netPayable, sign: "",
          })),
        },
        signatures: ["Prepared by", "Checked by (Accounts)", "Manager (HR & Compliance)", "Authorised signatory"],
      };
    },
  },
  {
    slug: "pay-slip",
    group: "Payroll",
    title: "Pay Slip (Actual & Compliance)",
    titleBn: "মজুরী স্লিপ",
    description: "Wage slip for each employee before payment (Rule 111(3), Form 38) in Bangla, or in English.",
    perm: "reports.salary",
    batch: 200,
    filters: ["format", ...PAY_FILTERS, "status"],
    formats: [
      { value: "bn", label: "Bangla — Form 38 wage slip" },
      { value: "en", label: "English pay slip" },
    ],
    async run(f, { company }) {
      const { run, slips: all } = await payslipsFor(f);
      if (!run) return noRun(f);
      const slips = takeBatch(f, all);
      const bnF = f.format !== "en";
      const perPage = 4;
      const pages = Array.from({ length: Math.ceil(slips.length / perPage) }, (_, i) => slips.slice(i * perPage, i * perPage + perPage));
      return {
        title: "Pay Slip",
        empty: slips.length ? undefined : "No payslips match.",
        node: pages.map((page, pi) => (
          <Sheet key={pi} last={pi === pages.length - 1}>
            <div className="grid grid-cols-2 gap-3">
              {page.map((s) => (bnF ? <BnSlip key={s.id} s={s} company={company} y={run.year} m={run.month} /> : <EnSlip key={s.id} s={s} company={company} y={run.year} m={run.month} />))}
            </div>
          </Sheet>
        )),
      };
    },
  },
  {
    slug: "salary-summary",
    group: "Payroll",
    title: "Salary Summary (Actual & Compliance)",
    description: "Monthly totals by department and section with payment-channel split.",
    perm: "reports.salary",
    filters: [...PAY_FILTERS],
    async run(f) {
      const { run, slips } = await payslipsFor(f);
      if (!run) return noRun(f);
      const chan = Object.fromEntries(PAYMENT_MODES.map((p) => [p.value, sumBy(slips.filter((s) => s.paymentMode === p.value), (s) => s.netPayable)]));
      return {
        title: "Salary Summary",
        subtitle: `${monthLabel(run.year, run.month)} · ${statusNote(run.status)}`,
        layout: "a4l",
        table: {
          serial: true,
          columns: [{ key: "unit", label: "Department › Section" }, ...SUMMARY_COLS],
          groups: [{ rows: rollup(slips, slipSec) }],
          notes: [`Net pay by channel — cash ${money(chan.CASH, false)}, bank ${money(chan.BANK, false)}, mobile banking ${money(chan.MFS, false)}.`],
        },
        signatures: ["Prepared by", "Accounts", "Authorised signatory"],
      };
    },
  },
  {
    slug: "salary-summary-status",
    group: "Payroll",
    title: "Salary Summary (Employee Status Wise)",
    description: "Regular employees, new joiners and separated employees (by separation type) for the month.",
    perm: "reports.salary",
    filters: [...PAY_FILTERS],
    async run(f) {
      const { run, slips } = await payslipsFor(f);
      if (!run) return noRun(f);
      return {
        title: "Salary Summary — Employee Status Wise",
        subtitle: monthLabel(run.year, run.month),
        layout: "a4l",
        table: {
          serial: true,
          columns: [{ key: "unit", label: "Status" }, ...SUMMARY_COLS],
          groups: [{ rows: rollup(slips, (s) => `${label(PAYSLIP_CATEGORIES, s.category)}${s.separationType && s.category !== "REGULAR" ? ` — ${label(SEPARATION_TYPES, s.separationType).replace(/ \(.*\)/, "")}` : ""}`) }],
        },
      };
    },
  },
  {
    slug: "salary-summary-type",
    group: "Payroll",
    title: "Salary Summary (Type Wise)",
    description: "Workers, staff and management totals by department.",
    perm: "reports.salary",
    filters: [...PAY_FILTERS],
    async run(f) {
      const { run, slips } = await payslipsFor(f);
      if (!run) return noRun(f);
      const types = ["WORKER", "STAFF", "MANAGEMENT"];
      return {
        title: "Salary Summary — Type Wise",
        subtitle: monthLabel(run.year, run.month),
        layout: "a4l",
        table: {
          columns: [{ key: "unit", label: "Department" }, ...SUMMARY_COLS],
          groups: types
            .map((t) => ({ title: t === "WORKER" ? "Workers" : t === "STAFF" ? "Staff" : "Management", rows: rollup(slips.filter((s) => s.empType === t), (s) => s.department.nameEn) }))
            .filter((g) => g.rows.length),
          subtotals: true,
        },
      };
    },
  },
  {
    slug: "only-salary",
    group: "Payroll",
    title: "Only Salary Sheet",
    description: "Wages without overtime (for factories that pay OT on a separate day). Net shown here excludes OT.",
    perm: "reports.salary",
    filters: [...PAY_FILTERS],
    async run(f) {
      const { run, slips } = await payslipsFor(f);
      if (!run) return noRun(f);
      return {
        title: "Only Salary Sheet",
        subtitle: `${monthLabel(run.year, run.month)} · overtime is on the Only Overtime Sheet`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "gross", label: "Gross", fmt: "money0", total: true },
            { key: "days", label: "Paid days", fmt: "num" }, { key: "earned", label: "Earned", fmt: "money0", total: true }, { key: "abd", label: "Absent ded.", fmt: "money0", total: true },
            { key: "bonus", label: "Att. bonus", fmt: "money0", total: true }, { key: "others", label: "Others", fmt: "money0", total: true },
            { key: "ded", label: "Deductions", fmt: "money0", total: true }, { key: "net", label: "Net (excl. OT)", fmt: "money0", total: true }, { key: "sign", label: "Signature" },
          ],
          groups: groupBy(slips, slipSec, (s) => ({
            code: s.employee.empCode, name: s.employee.nameEn, desig: s.designation.nameEn, gross: s.gross, days: s.payableDays, earned: s.earnedGross, abd: s.absentDeduction,
            bonus: s.attendanceBonus, others: others(s), ded: s.totalDeduction, net: Math.max(0, roundTk(s.grossPayable - s.otAmount - s.totalDeduction)), sign: "",
          })),
        },
        signatures: ["Prepared by", "Accounts", "Authorised signatory"],
      };
    },
  },
  {
    slug: "only-ot",
    group: "Payroll",
    title: "Only Overtime Sheet",
    description: "Overtime hours, rate (basic × 2 ÷ 208) and amount per employee.",
    perm: "reports.salary",
    filters: [...PAY_FILTERS],
    async run(f) {
      const { run, slips } = await payslipsFor(f, { otHours: { gt: 0 } });
      if (!run) return noRun(f);
      return {
        title: "Overtime Sheet",
        subtitle: monthLabel(run.year, run.month),
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "basic", label: "Basic", fmt: "money0" },
            { key: "otH", label: "OT hours", fmt: "hours", total: true }, { key: "rate", label: "Rate", fmt: "money" }, { key: "ot", label: "OT amount", fmt: "money", total: true }, { key: "sign", label: "Signature" },
          ],
          groups: groupBy(slips, slipSec, (s) => ({ code: s.employee.empCode, name: s.employee.nameEn, desig: s.designation.nameEn, basic: s.basic, otH: s.otHours, rate: s.otRate, ot: s.otAmount, sign: "" })),
        },
        signatures: ["Prepared by", "Accounts", "Authorised signatory"],
      };
    },
  },
  {
    slug: "salary-two-hour-ot",
    group: "Payroll",
    title: "Salary With Two Hours OT (statutory split)",
    description: "Salary sheet with overtime split into hours within the 2-hour daily limit and hours beyond it. Every hour is paid on this one sheet.",
    perm: "reports.salary",
    filters: [...PAY_FILTERS],
    async run(f, { company }) {
      const { run, slips } = await payslipsFor(f);
      if (!run) return noRun(f);
      return {
        title: "Salary Sheet — Overtime Within / Beyond the Daily Limit",
        subtitle: `${monthLabel(run.year, run.month)} · daily OT limit ${company.dailyOtLimit} h (s.100/108)`,
        layout: "legall",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "gross", label: "Gross", fmt: "money0", total: true },
            { key: "earned", label: "Earned − absent", fmt: "money0", total: true }, { key: "rate", label: "OT rate", fmt: "money" },
            { key: "nH", label: "OT h ≤ limit", fmt: "hours", total: true }, { key: "nA", label: "Amount", fmt: "money0", total: true },
            { key: "xH", label: "OT h > limit", fmt: "hours", total: true }, { key: "xA", label: "Amount", fmt: "money0", total: true },
            { key: "bonus", label: "Att. bonus", fmt: "money0", total: true }, { key: "others", label: "Others", fmt: "money0", total: true },
            { key: "ded", label: "Deductions", fmt: "money0", total: true }, { key: "net", label: "Net pay", fmt: "money0", total: true }, { key: "sign", label: "Signature" },
          ],
          groups: groupBy(slips, slipSec, (s) => {
            const nA = round2(s.otHoursNormal * s.otRate);
            return {
              code: s.employee.empCode, name: s.employee.nameEn, desig: s.designation.nameEn, gross: s.gross, earned: round2(s.earnedGross - s.absentDeduction), rate: s.otRate || "",
              nH: s.otHoursNormal, nA, xH: s.otHoursExcess, xA: round2(s.otAmount - nA), bonus: s.attendanceBonus, others: others(s), ded: s.totalDeduction, net: s.netPayable, sign: "",
            };
          }),
          notes: ["Net pay equals the salary sheet and pay slip: overtime beyond the limit is shown separately for monitoring, not paid off-record."],
        },
      };
    },
  },
  {
    slug: "extra-ot",
    group: "Payroll",
    title: "Extra OT Sheet (beyond daily limit)",
    description: "Overtime hours beyond the statutory daily limit, per employee — a management exposure report for corrective action. These amounts are already included in the salary sheet and pay slip.",
    perm: "reports.salary",
    filters: [...PAY_FILTERS],
    async run(f, { company }) {
      const { run, slips } = await payslipsFor(f, { otHoursExcess: { gt: 0 } });
      if (!run) return noRun(f);
      return {
        title: "Overtime Beyond the Daily Limit",
        subtitle: `${monthLabel(run.year, run.month)} · limit ${company.dailyOtLimit} h/day on working days`,
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "otH", label: "Total OT h", fmt: "hours", total: true },
            { key: "nH", label: "Within limit", fmt: "hours", total: true }, { key: "xH", label: "Beyond limit", fmt: "hours", total: true },
            { key: "rate", label: "Rate", fmt: "money" }, { key: "xA", label: "Beyond-limit amount (paid in salary)", fmt: "money0", total: true },
          ],
          groups: groupBy(slips, slipSec, (s) => ({
            code: s.employee.empCode, name: s.employee.nameEn, desig: s.designation.nameEn, otH: s.otHours, nH: s.otHoursNormal, xH: s.otHoursExcess, rate: s.otRate, xA: round2(s.otHoursExcess * s.otRate),
          })),
          notes: [
            "Hours beyond the limit need a government exemption (s.100) and must stay within 60 hours a week (s.102). Use this list to plan staffing and reduce excess hours.",
            "This is not a separate payment sheet: the same hours are already paid through the salary sheet.",
          ],
        },
      };
    },
  },
  {
    slug: "holiday-sheet",
    group: "Payroll",
    title: "Holiday Sheet",
    description: "Employees who worked on weekly or festival holidays: hours, overtime (workers) or holiday-duty allowance (staff), and the substitute holiday due.",
    perm: "reports.salary",
    filters: ["month", "org", "type"],
    async run(f, { company }) {
      const from = startOfMonth(f.month.year, f.month.month), to = endOfMonth(f.month.year, f.month.month);
      const days = await prisma.attendanceDay.findMany({
        where: { date: { gte: from, lte: to }, dayType: { not: "WORKDAY" }, status: { in: ["PRESENT", "LATE"] }, employee: employeeWhere(f.emp, { defaultStatus: "ALL" }) },
        include: { employee: { include: { department: true, section: true, designation: true } } },
        orderBy: [{ employee: { department: { sortOrder: "asc" } } }, { employee: { empCode: "asc" } }, { date: "asc" }],
      });
      const by = new Map<number, typeof days>();
      for (const d of days) by.set(d.employeeId, [...(by.get(d.employeeId) ?? []), d]);
      return {
        title: "Holiday Sheet",
        subtitle: `${monthLabel(f.month.year, f.month.month)} · holiday hours are overtime for workers; staff receive the holiday-duty allowance (${company.holidayAllowBasis.toLowerCase()} ÷ 30)`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "dates", label: "Holidays worked" },
            { key: "n", label: "Days", fmt: "int", total: true }, { key: "hours", label: "Hours", fmt: "hours", total: true }, { key: "ot", label: "OT h", fmt: "hours", total: true },
            { key: "otAmt", label: "OT amount", fmt: "money0", total: true }, { key: "allow", label: "Holiday allowance", fmt: "money0", total: true }, { key: "sub", label: "Substitute holiday given" },
          ],
          groups: groupBy([...by.values()], (l) => `${l[0].employee.department.nameEn} › ${l[0].employee.section.nameEn}`, (l) => {
            const e = l[0].employee;
            const ot = round2(l.reduce((s, d) => s + d.otHours, 0));
            const rate = e.otEligible ? round2((e.basic * company.otMultiplier) / company.otDivisor) : 0;
            const base = company.holidayAllowBasis === "BASIC" ? e.basic : e.gross;
            return {
              code: e.empCode, name: e.nameEn, desig: e.designation.nameEn, dates: l.map((d) => `${d.date.getUTCDate()}${d.dayType === "HOLIDAY" ? "H" : "W"}`).join(", "),
              n: l.length, hours: round2(l.reduce((s, d) => s + d.workMin / 60, 0)), ot, otAmt: round2(ot * rate),
              allow: !e.otEligible && company.holidayAllowBasis !== "NONE" ? round2(l.length * round2(base / 30)) : 0, sub: "",
            };
          }),
          notes: ["W = weekly holiday, H = festival / government holiday. A substitute holiday is due within 3 days of weekly-holiday work (s.103); festival-holiday work earns 2 compensatory days plus a substitute day (s.118(2))."],
        },
      };
    },
  },
  {
    slug: "bank-sheet",
    group: "Payroll",
    title: "Bank Sheet (Actual & Compliance)",
    description: "Bank advice for salary transfer, mobile-banking disbursement list, or cash payment list with revenue-stamp signatures.",
    perm: "reports.salary",
    filters: ["format", "month", "org", "type"],
    formats: [
      { value: "advice", label: "Bank advice letter (bank accounts)" },
      { value: "mfs", label: "Mobile banking list (bKash / Nagad / Rocket)" },
      { value: "cash", label: "Cash payment list" },
    ],
    async run(f, { company }) {
      const mode = f.format === "mfs" ? "MFS" : f.format === "cash" ? "CASH" : "BANK";
      const { run, slips } = await payslipsFor(f, { paymentMode: mode, netPayable: { gt: 0 } });
      if (!run) return noRun(f);
      const total = sumBy(slips, (s) => s.netPayable);
      const bank = await prisma.bankAccount.findFirst({ where: { active: true } });
      const toRow = (s: SlipRow): Row => ({
        code: s.employee.empCode, name: s.employee.nameEn, desig: s.designation.nameEn,
        acc: mode === "BANK" ? s.employee.bankAccountNo : mode === "MFS" ? s.employee.mfsNumber : "",
        prov: mode === "BANK" ? `${s.employee.bankName} ${s.employee.bankBranch}`.trim() : mode === "MFS" ? s.employee.mfsProvider : "",
        net: s.netPayable, sign: "",
      });
      const rows = slips.map(toRow);
      const columns: Col[] = [
        { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" },
        ...(mode !== "CASH" ? ([{ key: "prov", label: mode === "BANK" ? "Bank / branch" : "Provider" }, { key: "acc", label: mode === "BANK" ? "Account no." : "Wallet no." }] as Col[]) : []),
        { key: "net", label: "Amount", fmt: "money0", total: true },
        ...(mode === "CASH" ? ([{ key: "sign", label: "Signature over revenue stamp" }] as Col[]) : []),
      ];
      if (mode === "BANK") {
        return {
          title: "Bank Advice",
          node: (
            <Sheet last>
              <CompanyHeader company={company} />
              <div className="text-[12px] leading-relaxed">
                <p>Date: ____________</p>
                <p className="mt-2">
                  To
                  <br />
                  The Manager
                  <br />
                  {bank?.bankName ?? "____________"}, {bank?.branch ?? ""}
                  <br />
                  {bank?.address}
                </p>
                <p className="mt-3 font-semibold">Subject: Transfer of wages for {monthLabel(run.year, run.month)}</p>
                <p className="mt-2">
                  Dear Sir, please debit our account no. <b>{bank?.accountNo ?? "____________"}</b> ({bank?.accountName ?? company.nameEn}) by <b>Tk {money(total, false)}</b> ({enTakaWords(total)}) and credit the accounts of the {slips.length} employees listed below with the amounts shown.
                </p>
              </div>
              <TableInline columns={columns} rows={rows} />
              <Signatures labels={["Authorised signatory", "Authorised signatory"]} />
            </Sheet>
          ),
        };
      }
      return {
        title: mode === "MFS" ? "Mobile Banking Disbursement List" : "Cash Payment List",
        subtitle: `${monthLabel(run.year, run.month)} · ${slips.length} employees · Tk ${money(total, false)} (${enTakaWords(total)})`,
        table: { serial: true, columns, groups: groupBy(slips, slipSec, toRow), subtotals: true },
        signatures: ["Prepared by", "Paid by", "Witness", "Authorised signatory"],
      };
    },
  },
  {
    slug: "bonus-sheet",
    group: "Payroll",
    title: "Festival Bonus Sheet",
    description: "Bonus per employee by length of service (Labour Rules r.111(5)).",
    perm: "reports.salary",
    filters: ["bonus", "org", "type", "pay"],
    async run(f) {
      const run = f.bonus ? await prisma.bonusRun.findUnique({ where: { id: f.bonus } }) : await prisma.bonusRun.findFirst({ orderBy: { cutoffDate: "desc" } });
      if (!run) return { title: "Festival Bonus Sheet", empty: "No bonus sheet has been created." };
      const lines = await prisma.bonusLine.findMany({
        where: { runId: run.id, ...(f.emp.dept ? { departmentId: f.emp.dept } : {}), ...(f.emp.sec ? { sectionId: f.emp.sec } : {}), ...(f.emp.type ? { empType: f.emp.type } : {}), ...(f.emp.pay ? { paymentMode: f.emp.pay } : {}) },
        include: { employee: true, department: true, section: true, designation: true },
        orderBy: [{ department: { sortOrder: "asc" } }, { section: { sortOrder: "asc" } }, { employee: { empCode: "asc" } }],
      });
      return {
        title: `Festival Bonus Sheet — ${run.title}`,
        subtitle: `Service counted up to ${dmy(run.cutoffDate)} · basis: ${run.basis.toLowerCase()} · ${run.status.toLowerCase()}`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "join", label: "Joined", fmt: "date" },
            { key: "svc", label: "Service (months)", fmt: "int" }, { key: "basis", label: run.basis === "GROSS" ? "Gross" : "Basic", fmt: "money0" }, { key: "pct", label: "%", fmt: "num" },
            { key: "amount", label: "Bonus", fmt: "money0", total: true }, { key: "stamp", label: "Stamp", fmt: "money0", total: true }, { key: "net", label: "Net", fmt: "money0", total: true }, { key: "sign", label: "Signature" },
          ],
          groups: groupBy(lines, (l) => `${l.department.nameEn} › ${l.section.nameEn}`, (l) => ({
            code: l.employee.empCode, name: l.employee.nameEn, desig: l.designation.nameEn, join: l.employee.joinDate, svc: l.serviceMonths,
            basis: run.basis === "GROSS" ? l.gross : l.basic, pct: l.percent, amount: l.amount, stamp: l.stamp, net: l.net, sign: "",
          })),
        },
        signatures: ["Prepared by", "Accounts", "Authorised signatory"],
      };
    },
  },
  {
    slug: "bonus-summary",
    group: "Payroll",
    title: "Festival Bonus Summary",
    description: "Bonus totals by department and section.",
    perm: "reports.salary",
    filters: ["bonus"],
    async run(f) {
      const run = f.bonus ? await prisma.bonusRun.findUnique({ where: { id: f.bonus } }) : await prisma.bonusRun.findFirst({ orderBy: { cutoffDate: "desc" } });
      if (!run) return { title: "Festival Bonus Summary", empty: "No bonus sheet has been created." };
      const lines = await prisma.bonusLine.findMany({ where: { runId: run.id }, include: { department: true, section: true }, orderBy: [{ department: { sortOrder: "asc" } }, { section: { sortOrder: "asc" } }] });
      const m = new Map<string, typeof lines>();
      for (const l of lines) {
        const k = `${l.department.nameEn} › ${l.section.nameEn}`;
        m.set(k, [...(m.get(k) ?? []), l]);
      }
      return {
        title: `Festival Bonus Summary — ${run.title}`,
        table: {
          serial: true,
          columns: [
            { key: "unit", label: "Department › Section" }, { key: "n", label: "Employees", fmt: "int", total: true }, { key: "full", label: "100% slab", fmt: "int", total: true },
            { key: "part", label: "Partial slab", fmt: "int", total: true }, { key: "amount", label: "Bonus", fmt: "money0", total: true }, { key: "net", label: "Net", fmt: "money0", total: true },
          ],
          groups: [
            {
              rows: [...m.entries()].map(([unit, l]) => ({
                unit, n: l.length, full: l.filter((x) => x.percent >= 100).length, part: l.filter((x) => x.percent < 100).length, amount: sumBy(l, (x) => x.amount), net: sumBy(l, (x) => x.net),
              })),
            },
          ],
        },
      };
    },
  },
  {
    slug: "compare-salary",
    group: "Payroll",
    title: "Compare Salary Summary",
    description: "Two months side by side by department: headcount, overtime and net pay with differences.",
    perm: "reports.salary",
    filters: ["month", "month2"],
    async run(f) {
      const [a, b] = await Promise.all([payslipsFor(f), payslipsFor({ ...f, month: f.month2 })]);
      if (!a.run) return noRun(f);
      const depts = await prisma.department.findMany({ orderBy: { sortOrder: "asc" } });
      const la = monthLabel(f.month.year, f.month.month), lb = monthLabel(f.month2.year, f.month2.month);
      const rows = depts
        .map((d) => {
          const x = a.slips.filter((s) => s.departmentId === d.id), y = b.slips.filter((s) => s.departmentId === d.id);
          return {
            unit: d.nameEn, nA: x.length, nB: y.length, otA: sumBy(x, (s) => s.otAmount), otB: sumBy(y, (s) => s.otAmount),
            netA: sumBy(x, (s) => s.netPayable), netB: sumBy(y, (s) => s.netPayable), diff: round2(sumBy(x, (s) => s.netPayable) - sumBy(y, (s) => s.netPayable)),
          };
        })
        .filter((r) => r.nA || r.nB);
      return {
        title: "Compare Salary Summary",
        subtitle: `${la} vs ${lb}`,
        layout: "a4l",
        table: {
          serial: true,
          columns: [
            { key: "unit", label: "Department" }, { key: "nA", label: `Emp. ${la}`, fmt: "int", total: true }, { key: "nB", label: `Emp. ${lb}`, fmt: "int", total: true },
            { key: "otA", label: `OT ${la}`, fmt: "money0", total: true }, { key: "otB", label: `OT ${lb}`, fmt: "money0", total: true },
            { key: "netA", label: `Net ${la}`, fmt: "money0", total: true }, { key: "netB", label: `Net ${lb}`, fmt: "money0", total: true }, { key: "diff", label: "Difference", fmt: "money0", total: true },
          ],
          groups: [{ rows }],
        },
      };
    },
  },
  {
    slug: "el-encashment",
    group: "Leave",
    title: "Earn Leave Encashment",
    description: "Earned-leave encashment sheet (Rule 107(2): up to half the balance, once a year). Choose a saved sheet, or see the live calculation.",
    perm: "reports.salary",
    filters: ["elrun", "org"],
    async run(f, { company, today }) {
      if (f.elrun) {
        const run = await prisma.elEncashRun.findUnique({ where: { id: f.elrun } });
        if (!run) return { title: "Earn Leave Encashment", empty: "Sheet not found." };
        const lines = await prisma.elEncashLine.findMany({
          where: { runId: run.id, employee: employeeWhere(f.emp, { defaultStatus: "ALL" }) },
          include: { employee: { include: { department: true, section: true, designation: true } } },
          orderBy: [{ employee: { department: { sortOrder: "asc" } } }, { employee: { empCode: "asc" } }],
        });
        return {
          title: `Earn Leave Encashment — ${run.title}`,
          subtitle: `Balances as of ${dmy(run.asOfDate)} · ${run.status === "POSTED" ? "posted" : "draft (not yet deducted from balances)"}`,
          layout: "a4l",
          table: {
            serial: true,
            subtotals: true,
            columns: [
              { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "earned", label: "Earned", fmt: "num" },
              { key: "availed", label: "Availed", fmt: "num" }, { key: "bal", label: "Balance", fmt: "num" }, { key: "days", label: "Encash days", fmt: "num", total: true },
              { key: "rate", label: "Rate/day", fmt: "money" }, { key: "amount", label: "Amount", fmt: "money0", total: true }, { key: "stamp", label: "Stamp", fmt: "money0", total: true },
              { key: "net", label: "Net", fmt: "money0", total: true }, { key: "sign", label: "Signature" },
            ],
            groups: groupBy(lines, (l) => `${l.employee.department.nameEn} › ${l.employee.section.nameEn}`, (l) => ({
              code: l.employee.empCode, name: l.employee.nameEn, desig: l.employee.designation.nameEn, earned: l.earnedDays, availed: l.availedDays, bal: l.balanceDays,
              days: l.encashDays, rate: l.rate, amount: l.amount, stamp: l.stamp, net: l.net, sign: "",
            })),
          },
          signatures: ["Prepared by", "Accounts", "Authorised signatory"],
        };
      }
      const emps = await prisma.employee.findMany({ where: employeeWhere(f.emp), include: { department: true, section: true, designation: true }, orderBy: [{ department: { sortOrder: "asc" } }, { empCode: "asc" }] });
      const eligible = emps.filter((e) => monthsBetween(e.joinDate, today) >= company.elEligibleMonths);
      const bal = await leaveBalances(prisma, eligible.map((e) => e.id), today.getUTCFullYear(), today);
      return {
        title: "Earn Leave Encashment — live calculation",
        subtitle: `As of ${dmy(today)} · not saved; create a sheet under Payroll → EL Encashment to post it`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "bal", label: "Balance", fmt: "num" },
            { key: "days", label: "Encashable", fmt: "num", total: true }, { key: "rate", label: "Rate/day", fmt: "money" }, { key: "amount", label: "Amount", fmt: "money0", total: true },
          ],
          groups: groupBy(eligible, (e) => `${e.department.nameEn} › ${e.section.nameEn}`, (e) => {
            const el = bal.get(e.id)?.find((b) => b.accrual === "EARNED");
            const days = elEncashable(el?.balance ?? 0, company.elEncashMaxPercent);
            const rate = round2((company.elRateBasis === "BASIC" ? e.basic : e.gross) / 30);
            return { code: e.empCode, name: e.nameEn, desig: e.designation.nameEn, bal: el?.balance ?? 0, days, rate, amount: round2(days * rate) };
          }),
        },
      };
    },
  },
];

function TableInline({ columns, rows }: { columns: Col[]; rows: Row[] }) {
  const total = sumBy(rows, (r) => (r.net as number) || 0);
  return (
    <table className="dt mt-3">
      <thead>
        <tr>
          <th>SL</th>
          {columns.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="center">{i + 1}</td>
            {columns.map((c) => (
              <td key={c.key} className={c.fmt ? "num" : ""}>
                {c.fmt ? money(r[c.key] as number, false) : String(r[c.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
        <tr className="font-bold">
          <td colSpan={columns.length} className="text-right">
            Total
          </td>
          <td className="num">{money(total, false)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function BnSlip({ s, company, y, m }: { s: SlipRow; company: { nameBn: string; nameEn: string }; y: number; m: number }) {
  const p = proRated(s);
  const rows: [string, number][] = [
    ["মূল মজুরী", p.basic],
    ["বাড়ী ভাড়া", p.hr],
    ["চিকিৎসা ভাতা", p.med],
    ["যাতায়াত ভাতা", p.tr],
    ["খাদ্য ভাতা", p.food],
    ["হাজিরা বোনাস", s.attendanceBonus],
    [`অধিকাল (${bn(s.otHours)} ঘন্টা × ${bn(money(s.otRate))})`, s.otAmount],
    ["অন্যান্য", others(s)],
  ];
  const ded: [string, number][] = [
    [`অনুপস্থিতি (${bn(s.absentDays)} দিন)`, s.absentDeduction],
    ["অগ্রিম", s.advanceDeduction],
    ["স্ট্যাম্প", s.stamp],
    ["আয়কর ও অন্যান্য", round2(s.tax + s.otherDeduction)],
  ];
  return (
    <div className="avoid-break border border-black p-2 font-bn text-[11px]">
      <div className="text-center font-bold">{company.nameBn || company.nameEn}</div>
      <div className="text-center">মজুরী স্লিপ — {bnMonthLabel(y, m)} (ফরম ৩৮)</div>
      <div className="mt-1 grid grid-cols-2 gap-x-2">
        <div>নাম: {s.employee.nameBn || s.employee.nameEn}</div>
        <div>আইডি: {bn(s.employee.empCode)}</div>
        <div>পদবী: {s.designation.nameBn || s.designation.nameEn}</div>
        <div>সেকশন: {s.section.nameBn || s.section.nameEn}</div>
        <div>মোট মজুরী: {bnMoney(s.gross, false)}</div>
        <div>
          উপস্থিত {bn(s.presentDays)} · ছুটি {bn(s.paidLeaveDays + s.unpaidLeaveDays)} · অনুপস্থিত {bn(s.absentDays)}
        </div>
      </div>
      <table className="dt mt-1">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td className="num">{bnMoney(v)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td>মোট</td>
            <td className="num">{bnMoney(round2(s.earnedGross + s.attendanceBonus + s.otAmount + others(s)))}</td>
          </tr>
          {ded.map(([k, v]) => (
            <tr key={k}>
              <td>কর্তন: {k}</td>
              <td className="num">{bnMoney(v)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td>নীট প্রদেয়</td>
            <td className="num">{bnMoney(s.netPayable, false)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-1">কথায়: {bnTakaWords(s.netPayable)}</div>
      <div className="mt-6 flex justify-between">
        <span className="border-t border-black px-2">শ্রমিকের স্বাক্ষর</span>
        <span className="border-t border-black px-2">কর্তৃপক্ষের স্বাক্ষর</span>
      </div>
    </div>
  );
}

function EnSlip({ s, company, y, m }: { s: SlipRow; company: { nameEn: string }; y: number; m: number }) {
  const p = proRated(s);
  const earn: [string, number][] = [
    ["Basic", p.basic], ["House rent", p.hr], ["Medical", p.med], ["Transport", p.tr], ["Food", p.food],
    ["Attendance bonus", s.attendanceBonus], [`Overtime ${s.otHours} h × ${money(s.otRate)}`, s.otAmount], ["Others", others(s)],
  ];
  const ded: [string, number][] = [[`Absent (${s.absentDays} d)`, s.absentDeduction], ["Advance", s.advanceDeduction], ["Stamp", s.stamp], ["Tax / other", round2(s.tax + s.otherDeduction)]];
  return (
    <div className="avoid-break border border-black p-2 text-[11px]">
      <div className="text-center font-bold">{company.nameEn}</div>
      <div className="text-center">Pay slip — {monthLabel(y, m)}</div>
      <div className="mt-1 grid grid-cols-2 gap-x-2">
        <div>Name: {s.employee.nameEn}</div>
        <div>ID: {s.employee.empCode}</div>
        <div>Designation: {s.designation.nameEn}</div>
        <div>Section: {s.section.nameEn}</div>
        <div>Gross: {money(s.gross, false)}</div>
        <div>
          Present {s.presentDays} · Leave {s.paidLeaveDays + s.unpaidLeaveDays} · Absent {s.absentDays}
        </div>
      </div>
      <table className="dt mt-1">
        <tbody>
          {earn.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td className="num">{money(v)}</td>
            </tr>
          ))}
          {ded.map(([k, v]) => (
            <tr key={k}>
              <td>Less: {k}</td>
              <td className="num">{money(v)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td>Net pay</td>
            <td className="num">{money(s.netPayable, false)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-1">{enTakaWords(s.netPayable)}</div>
      <div className="mt-6 flex justify-between">
        <span className="border-t border-black px-2">Employee</span>
        <span className="border-t border-black px-2">Authorised</span>
      </div>
    </div>
  );
}
