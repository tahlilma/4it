import { Sheet, CompanyHeader } from "@/components/report/sheet";
import { enAddress } from "@/components/report/doc";
import { can } from "../../auth";
import { AGE_PROOF, EMP_TYPES, EMPLOYMENT_NATURE, GENDERS, label, MARITAL, PAYMENT_MODES, RELIGIONS, SEPARATION_TYPES } from "../../constants";
import { ageOn, dmy, endOfMonth, monthLabel, serviceSpan, spanText, startOfMonth } from "../../dates";
import { prisma } from "../../db";
import { inChunks } from "../../chunk";
import { employeeWhere } from "../../employee-filter";
import { otRate } from "../../engine/salary";
import { round2 } from "../../num";
import type { Col, ReportDef, Row } from "../types";
import { groupBy, loadEmployees, secTitle, takeBatch } from "../util";

const ORG_FILTERS = ["emp", "org", "type", "gender", "status"] as const;

export const employeeReports: ReportDef[] = [
  {
    slug: "all-employees",
    group: "Employee",
    title: "All Employee Report",
    description: "Employee list grouped by department and section.",
    perm: "reports.hr",
    filters: [...ORG_FILTERS, "religion", "grade", "floor", "pay"],
    async run(f, { user, today }) {
      const emps = takeBatch(f, await loadEmployees(f, {}, "ACTIVE"));
      const salary = can(user, "salary.view");
      const columns: Col[] = [
        { key: "code", label: "ID" },
        { key: "name", label: "Name" },
        { key: "desig", label: "Designation" },
        { key: "grade", label: "Grade" },
        { key: "line", label: "Line" },
        { key: "join", label: "Joined", fmt: "date" },
        { key: "service", label: "Service" },
        { key: "gender", label: "Sex" },
        ...(salary ? [{ key: "gross", label: "Gross", fmt: "money0", total: true } as Col] : []),
        { key: "mobile", label: "Mobile" },
        { key: "status", label: "Status" },
      ];
      return {
        title: "All Employee Report",
        subtitle: `${emps.length} employees · as on ${dmy(today)}`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns,
          groups: groupBy(emps, secTitle, (e) => ({
            code: e.empCode, name: e.nameEn, desig: e.designation.nameEn, grade: e.grade?.nameEn ?? "", line: e.line?.nameEn ?? "",
            join: e.joinDate, service: spanText(serviceSpan(e.joinDate, e.separationDate ?? today)).replace(/ (years?|months?|days?)/g, (m) => m.trim()[0]),
            gender: label(GENDERS, e.gender).charAt(0), gross: e.gross, mobile: e.mobile, status: e.status === "ACTIVE" ? "Active" : "Separated",
          })),
        },
      };
    },
  },
  {
    slug: "employee-details",
    group: "Employee",
    title: "Details Employee Report",
    description: "Complete personal-file data sheet, one page per employee.",
    perm: "reports.hr",
    batch: 100,
    filters: [...ORG_FILTERS],
    async run(f, { company, user, today }) {
      const emps = await loadEmployees(f, {}, "ACTIVE");
      const salary = can(user, "salary.view");
      const nominees = await prisma.nominee.findMany({ where: { employeeId: { in: emps.map((e) => e.id) } } });
      const kv = (items: [string, unknown][]) => (
        <table className="dt">
          <tbody>
            {Array.from({ length: Math.ceil(items.length / 2) }).map((_, i) => (
              <tr key={i}>
                {items.slice(i * 2, i * 2 + 2).map(([k, v]) => (
                  <Cells key={k} k={k} v={v} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      return {
        title: "Details Employee Report",
        empty: emps.length ? undefined : "No employees.",
        node: emps.map((e, i) => (
          <Sheet key={e.id} last={i === emps.length - 1}>
            <CompanyHeader company={company} title="Employee Details" subtitle={`${e.empCode} — ${e.nameEn}`} />
            <div className="mb-2 font-semibold">Personal</div>
            {kv([
              ["Name", e.nameEn], ["নাম", e.nameBn], ["Father", e.fatherEn], ["Mother", e.motherEn], ["Spouse", e.spouseEn],
              ["Gender", label(GENDERS, e.gender)], ["Date of birth", `${dmy(e.dob)} (${ageOn(e.dob, today)} yrs)`], ["Religion", label(RELIGIONS, e.religion)],
              ["Marital status", label(MARITAL, e.maritalStatus)], ["Children", e.childrenCount], ["Blood group", e.bloodGroup], ["NID", e.nidNo],
              ["Birth reg. no.", e.birthRegNo], ["Age proof", label(AGE_PROOF, e.ageProofType)], ["Education", e.educationEn], ["Height", e.heightCm ? `${e.heightCm} cm` : ""],
              ["Identification mark", e.identMarkEn], ["Mobile", e.mobile], ["Emergency contact", `${e.emergencyName} ${e.emergencyPhone}`], ["Reference", e.referenceName],
            ])}
            <div className="mb-2 mt-3 font-semibold">Address</div>
            {kv([["Present", enAddress(e, "pres")], ["Permanent", enAddress(e, "perm")]])}
            <div className="mb-2 mt-3 font-semibold">Employment</div>
            {kv([
              ["Department", e.department.nameEn], ["Section", e.section.nameEn], ["Designation", e.designation.nameEn], ["Grade", e.grade?.nameEn ?? ""],
              ["Line", e.line?.nameEn ?? ""], ["Floor", e.floor?.nameEn ?? ""], ["Shift", e.shift.name], ["Type", label(EMP_TYPES, e.empType)],
              ["Class (s.4)", label(EMPLOYMENT_NATURE, e.employmentNature)], ["Joined", dmy(e.joinDate)], ["Confirmed", dmy(e.confirmDate)],
              ["Service", spanText(serviceSpan(e.joinDate, e.separationDate ?? today))], ["Status", e.status], ["Punch ID", e.punchId],
            ])}
            {salary && (
              <>
                <div className="mb-2 mt-3 font-semibold">Salary</div>
                {kv([
                  ["Gross", e.gross], ["Basic", e.basic], ["House rent", e.houseRent], ["Medical", e.medical], ["Transport", e.transport], ["Food", e.food],
                  ["OT rate / hour", e.otEligible ? otRate(e.basic, company) : "Not eligible"], ["Payment", `${label(PAYMENT_MODES, e.paymentMode)} ${e.bankAccountNo || e.mfsNumber}`],
                ])}
              </>
            )}
            <div className="mb-2 mt-3 font-semibold">Nominees</div>
            <table className="dt">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Relationship</th>
                  <th>Age</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {nominees.filter((n) => n.employeeId === e.id).map((n) => (
                  <tr key={n.id}>
                    <td>{n.nameEn}</td>
                    <td>{n.relationEn}</td>
                    <td className="center">{n.age}</td>
                    <td className="num">{n.sharePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sheet>
        )),
      };
    },
  },
  {
    slug: "new-employees",
    group: "Employee",
    title: "Monthly New Employee Report",
    description: "Employees who joined during the month.",
    perm: "reports.hr",
    filters: ["month", "org", "type", "gender"],
    defaults: { month: "current" },
    async run(f, { user }) {
      const from = startOfMonth(f.month.year, f.month.month), to = endOfMonth(f.month.year, f.month.month);
      f.emp.status = "ALL";
      const emps = await loadEmployees(f, { joinDate: { gte: from, lte: to } }, "ALL");
      const salary = can(user, "salary.view");
      return {
        title: "Monthly New Employee Report",
        subtitle: `${monthLabel(f.month.year, f.month.month)} — ${emps.length} joiners`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "grade", label: "Grade" },
            { key: "join", label: "Joined", fmt: "date" }, { key: "dob", label: "Date of birth", fmt: "date" }, { key: "nid", label: "NID" },
            { key: "mobile", label: "Mobile" }, ...(salary ? [{ key: "gross", label: "Gross", fmt: "money0", total: true } as Col] : []),
            { key: "status", label: "Status" },
          ],
          groups: groupBy(emps, secTitle, (e) => ({
            code: e.empCode, name: e.nameEn, desig: e.designation.nameEn, grade: e.grade?.nameEn ?? "", join: e.joinDate, dob: e.dob, nid: e.nidNo,
            mobile: e.mobile, gross: e.gross, status: e.status === "ACTIVE" ? "Active" : "Separated",
          })),
        },
      };
    },
  },
  {
    slug: "dropouts",
    group: "Employee",
    title: "Monthly Drop Out Employee Report",
    description: "Separations (resignation, lefty, termination …) effective in the month.",
    perm: "reports.hr",
    filters: ["month", "org", "type"],
    defaults: { month: "current" },
    async run(f) {
      const from = startOfMonth(f.month.year, f.month.month), to = endOfMonth(f.month.year, f.month.month);
      f.emp.status = "ALL";
      const emps = await loadEmployees(f, { separation: { effectiveDate: { gte: from, lte: to } } }, "ALL");
      const seps = await prisma.separation.findMany({ where: { employeeId: { in: emps.map((e) => e.id) } } });
      const sepBy = new Map(seps.map((s) => [s.employeeId, s]));
      return {
        title: "Monthly Drop Out Employee Report",
        subtitle: `${monthLabel(f.month.year, f.month.month)} — ${emps.length} separations`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "join", label: "Joined", fmt: "date" },
            { key: "last", label: "Last day", fmt: "date" }, { key: "service", label: "Service" }, { key: "type", label: "Type" }, { key: "reason", label: "Reason" },
            { key: "settle", label: "Settlement" }, { key: "net", label: "Net payable", fmt: "money0", total: true },
          ],
          groups: groupBy(emps, secTitle, (e) => {
            const s = sepBy.get(e.id)!;
            return {
              code: e.empCode, name: e.nameEn, desig: e.designation.nameEn, join: e.joinDate, last: s.effectiveDate,
              service: spanText(serviceSpan(e.joinDate, s.effectiveDate)), type: label(SEPARATION_TYPES, s.type).replace(/ \(.*\)/, ""),
              reason: s.reason, settle: s.settlementStatus.toLowerCase(), net: s.netPayable,
            };
          }),
        },
      };
    },
  },
  {
    slug: "manpower-requisition",
    group: "Employee",
    title: "Manpower Requisition Report",
    description: "Approved manpower vs. actual headcount by department, section, designation and line.",
    perm: "reports.hr",
    filters: ["org"],
    async run(f) {
      const budgets = await prisma.manpowerBudget.findMany({
        where: { ...(f.emp.dept ? { departmentId: f.emp.dept } : {}), ...(f.emp.sec ? { sectionId: f.emp.sec } : {}) },
        include: { department: true, section: true, designation: true, line: true },
        orderBy: [{ department: { sortOrder: "asc" } }, { section: { sortOrder: "asc" } }],
      });
      const rows: Row[] = [];
      for (const b of budgets) {
        const actual = await prisma.employee.count({
          where: { status: "ACTIVE", departmentId: b.departmentId, ...(b.sectionId ? { sectionId: b.sectionId } : {}), ...(b.designationId ? { designationId: b.designationId } : {}), ...(b.lineId ? { lineId: b.lineId } : {}) },
        });
        rows.push({
          dept: b.department.nameEn, sec: b.section?.nameEn ?? "All", desig: b.designation?.nameEn ?? "All", line: b.line?.nameEn ?? "",
          required: b.required, actual, short: Math.max(0, b.required - actual), excess: Math.max(0, actual - b.required),
          pct: b.required ? round2((actual / b.required) * 100) : 0,
        });
      }
      return {
        title: "Manpower Requisition Report",
        subtitle: "Required (approved budget) vs. active headcount",
        table: {
          serial: true,
          columns: [
            { key: "dept", label: "Department" }, { key: "sec", label: "Section" }, { key: "desig", label: "Designation" }, { key: "line", label: "Line" },
            { key: "required", label: "Required", fmt: "int", total: true }, { key: "actual", label: "Actual", fmt: "int", total: true },
            { key: "short", label: "Shortage", fmt: "int", total: true }, { key: "excess", label: "Excess", fmt: "int", total: true }, { key: "pct", label: "Filled", fmt: "pct" },
          ],
          groups: [{ rows }],
          notes: budgets.length ? undefined : ["No manpower budget is defined yet — add it under Master Data → Manpower Requisition."],
        },
      };
    },
  },
  summaryReport("dept-summary", "Dept Wise Employee Summary Report", "Headcount by department and section with gender and type split.", "section"),
  summaryReport("type-summary", "Employee Type Wise Summary Report", "Workers, staff and management by department.", "department"),
  {
    slug: "designation-grade",
    group: "Employee",
    title: "Designation & Grade Wise Report",
    description: "Headcount and wage range per designation and grade, with employees below the grade minimum flagged.",
    perm: "reports.hr",
    filters: ["org", "type"],
    async run(f, { user }) {
      const emps = await loadEmployees(f);
      const salary = can(user, "salary.view");
      const map = new Map<string, { desig: string; grade: string; n: number; min: number; max: number; sum: number; below: number; gradeMin: number }>();
      for (const e of emps) {
        const k = `${e.designation.sortOrder}|${e.designation.nameEn}|${e.grade?.nameEn ?? "-"}`;
        const x = map.get(k) ?? { desig: e.designation.nameEn, grade: e.grade?.nameEn ?? "—", n: 0, min: Infinity, max: 0, sum: 0, below: 0, gradeMin: e.grade?.minGross ?? 0 };
        x.n++;
        x.min = Math.min(x.min, e.gross);
        x.max = Math.max(x.max, e.gross);
        x.sum += e.gross;
        if (e.empType === "WORKER" && e.grade && e.grade.minGross > 0 && e.gross < e.grade.minGross) x.below++;
        map.set(k, x);
      }
      const rows = [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([, x]) => ({
        desig: x.desig, grade: x.grade, n: x.n, gradeMin: x.gradeMin || "", min: x.min, max: x.max, avg: round2(x.sum / x.n), below: x.below || "",
      }));
      return {
        title: "Designation & Grade Wise Report",
        table: {
          serial: true,
          columns: [
            { key: "desig", label: "Designation" }, { key: "grade", label: "Grade" }, { key: "n", label: "Employees", fmt: "int", total: true },
            ...(salary
              ? ([
                  { key: "gradeMin", label: "Grade minimum", fmt: "money0" }, { key: "min", label: "Lowest gross", fmt: "money0" },
                  { key: "max", label: "Highest gross", fmt: "money0" }, { key: "avg", label: "Average gross", fmt: "money0" }, { key: "below", label: "Below minimum", fmt: "int" },
                ] as Col[])
              : []),
          ],
          groups: [{ rows }],
        },
      };
    },
  },
  {
    slug: "gender-summary",
    group: "Employee",
    title: "Gender Wise Employee Report",
    description: "Male / female / third-gender headcount by department and section.",
    perm: "reports.hr",
    filters: ["org", "type"],
    async run(f) {
      const emps = await loadEmployees(f);
      const rows = rollup(emps, secTitle, (list) => {
        const m = list.filter((e) => e.gender === "MALE").length, w = list.filter((e) => e.gender === "FEMALE").length, o = list.length - m - w;
        return { male: m, female: w, other: o, total: list.length, fpct: round2((w / list.length) * 100) };
      });
      return {
        title: "Gender Wise Employee Report",
        table: {
          serial: true,
          columns: [
            { key: "unit", label: "Department › Section" }, { key: "male", label: "Male", fmt: "int", total: true }, { key: "female", label: "Female", fmt: "int", total: true },
            { key: "other", label: "Third gender", fmt: "int", total: true }, { key: "total", label: "Total", fmt: "int", total: true }, { key: "fpct", label: "Women %", fmt: "pct" },
          ],
          groups: [{ rows }],
        },
      };
    },
  },
  {
    slug: "religion-summary",
    group: "Employee",
    title: "Religion Wise Employee Report",
    description: "Headcount by religion — used to plan festival bonuses and holidays.",
    perm: "reports.hr",
    filters: ["org", "type"],
    async run(f) {
      const emps = await loadEmployees(f);
      const rows = rollup(emps, (e) => e.department.nameEn, (list) => Object.fromEntries([...RELIGIONS.map((r) => [r.value, list.filter((e) => e.religion === r.value).length]), ["total", list.length]]));
      return {
        title: "Religion Wise Employee Report",
        table: {
          serial: true,
          columns: [{ key: "unit", label: "Department" }, ...RELIGIONS.map((r) => ({ key: r.value, label: r.en, fmt: "int", total: true }) as Col), { key: "total", label: "Total", fmt: "int", total: true }],
          groups: [{ rows }],
        },
      };
    },
  },
  {
    slug: "salary-history",
    group: "Employee",
    title: "Employee Wise Salary History",
    description: "Joining salary, increments, promotions and adjustments per employee.",
    perm: "reports.salary",
    filters: ["emp", "org", "status"],
    async run(f) {
      const emps = await loadEmployees(f);
      const hist = await inChunks(emps.map((e) => e.id), (slice) =>
        prisma.salaryHistory.findMany({ where: { employeeId: { in: slice } }, include: { designation: true, grade: true }, orderBy: [{ employeeId: "asc" }, { effectiveDate: "asc" }] }),
      );
      const byEmp = new Map<number, typeof hist>();
      for (const h of hist) byEmp.set(h.employeeId, [...(byEmp.get(h.employeeId) ?? []), h]);
      return {
        title: "Employee Wise Salary History",
        layout: "a4l",
        table: {
          columns: [
            { key: "date", label: "Effective", fmt: "date" }, { key: "type", label: "Type" }, { key: "desig", label: "Designation" }, { key: "grade", label: "Grade" },
            { key: "basic", label: "Basic", fmt: "money0" }, { key: "hr", label: "House rent", fmt: "money0" }, { key: "med", label: "Medical", fmt: "money0" },
            { key: "tr", label: "Transport", fmt: "money0" }, { key: "food", label: "Food", fmt: "money0" }, { key: "gross", label: "Gross", fmt: "money0" },
            { key: "amount", label: "Change", fmt: "money0" }, { key: "remarks", label: "Remarks" },
          ],
          groups: emps.map((e) => ({
            title: `${e.empCode} — ${e.nameEn} (${e.designation.nameEn}, joined ${dmy(e.joinDate)})`,
            rows: (byEmp.get(e.id) ?? []).map((h) => ({
              date: h.effectiveDate, type: h.type.toLowerCase(), desig: h.designation?.nameEn ?? "", grade: h.grade?.nameEn ?? "", basic: h.basic, hr: h.houseRent,
              med: h.medical, tr: h.transport, food: h.food, gross: h.gross, amount: h.amount || "", remarks: h.remarks,
            })),
          })),
          grandTotal: false,
        },
      };
    },
  },
  {
    slug: "salary-structure",
    group: "Employee",
    title: "Salary Sheet Wise Employee Report",
    description: "Current salary structure of every employee as it appears on the salary sheet.",
    perm: "reports.salary",
    filters: ["emp", "org", "type", "grade", "pay"],
    async run(f, { company }) {
      const emps = await loadEmployees(f);
      return {
        title: "Salary Sheet Wise Employee Report",
        subtitle: "Current salary structure",
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "grade", label: "Grade" },
            { key: "basic", label: "Basic", fmt: "money0", total: true }, { key: "hr", label: "House rent", fmt: "money0", total: true },
            { key: "med", label: "Medical", fmt: "money0", total: true }, { key: "tr", label: "Transport", fmt: "money0", total: true },
            { key: "food", label: "Food", fmt: "money0", total: true }, { key: "other", label: "Other", fmt: "money0", total: true },
            { key: "gross", label: "Gross", fmt: "money0", total: true }, { key: "ot", label: "OT rate", fmt: "money" }, { key: "pay", label: "Payment" },
          ],
          groups: groupBy(emps, secTitle, (e) => ({
            code: e.empCode, name: e.nameEn, desig: e.designation.nameEn, grade: e.grade?.nameEn ?? "", basic: e.basic, hr: e.houseRent, med: e.medical,
            tr: e.transport, food: e.food, other: e.otherAllowance, gross: e.gross, ot: e.otEligible ? otRate(e.basic, company) : "", pay: label(PAYMENT_MODES, e.paymentMode),
          })),
        },
      };
    },
  },
  {
    slug: "safety-teams",
    group: "Employee",
    title: "Team Report (Fire, First Aid, Rescue)",
    titleBn: "অগ্নি নির্বাপণ, প্রাথমিক চিকিৎসা ও উদ্ধারকারী দল",
    description: "Team members, and coverage per department against Labour Rules r.55(10) (each team ≥ 6 %, trained ≥ 18 %).",
    perm: "reports.hr",
    filters: ["format", "team", "org"],
    formats: [
      { value: "members", label: "Team members" },
      { value: "coverage", label: "Coverage vs. r.55(10)" },
    ],
    async run(f) {
      const teams = await prisma.team.findMany({ orderBy: { sortOrder: "asc" }, where: f.team ? { id: f.team } : {} });
      const members = await prisma.employeeTeam.findMany({
        where: { teamId: { in: teams.map((t) => t.id) }, employee: { status: "ACTIVE", ...employeeWhere(f.emp) } },
        include: { team: true, employee: { include: { designation: true, section: true, department: true, floor: true } } },
        orderBy: [{ team: { sortOrder: "asc" } }, { role: "asc" }, { employee: { empCode: "asc" } }],
      });
      if (f.format === "coverage") {
        const depts = await prisma.department.findMany({ orderBy: { sortOrder: "asc" }, where: f.emp.dept ? { id: f.emp.dept } : {} });
        const rows: Row[] = [];
        for (const d of depts) {
          const head = await prisma.employee.count({ where: { status: "ACTIVE", departmentId: d.id } });
          if (!head) continue;
          const row: Row = { dept: d.nameEn, head };
          const trained = new Set<number>();
          for (const t of teams) {
            const n = members.filter((m) => m.teamId === t.id && m.employee.departmentId === d.id);
            n.forEach((m) => trained.add(m.employeeId));
            const p = round2((n.length / head) * 100);
            row[t.code] = `${n.length} (${p}%)${p < t.requiredPercent ? " ✗" : ""}`;
          }
          const tp = round2((trained.size / head) * 100);
          row.trained = `${trained.size} (${tp}%)${tp < 18 ? " ✗" : ""}`;
          rows.push(row);
        }
        return {
          title: "Safety Team Coverage",
          titleBn: "অগ্নি নির্বাপণ, উদ্ধার ও প্রাথমিক চিকিৎসা দল — বিধি ৫৫(১০)",
          table: {
            serial: true,
            columns: [{ key: "dept", label: "Department" }, { key: "head", label: "Headcount", fmt: "int", total: true }, ...teams.map((t) => ({ key: t.code, label: `${t.nameEn} (≥${t.requiredPercent}%)` })), { key: "trained", label: "Trained (≥18%)" }],
            groups: [{ rows }],
            notes: ["✗ = below the Labour Rules 2015 r.55(10) minimum. Team members must wear identifying aprons (r.55(11))."],
          },
        };
      }
      return {
        title: "Team Report (Fire, First Aid, Rescue)",
        titleBn: "অগ্নি নির্বাপণ, প্রাথমিক চিকিৎসা ও উদ্ধারকারী দল",
        layout: "a4l",
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "sec", label: "Department / section" },
            { key: "floor", label: "Floor" }, { key: "role", label: "Role" }, { key: "date", label: "Training date", fmt: "date" }, { key: "by", label: "Trained by" }, { key: "cert", label: "Certificate" },
          ],
          groups: groupBy(members, (m) => m.team.nameEn, (m) => ({
            code: m.employee.empCode, name: m.employee.nameEn, desig: m.employee.designation.nameEn, sec: secTitle(m.employee), floor: m.employee.floor?.nameEn ?? "",
            role: m.role === "LEADER" ? "Team leader" : "Member", date: m.trainingDate, by: m.trainedBy, cert: m.certificateNo,
          })),
          grandTotal: false,
        },
      };
    },
  },
  {
    slug: "device-due",
    group: "Employee",
    title: "Due Punch Machine Assign Employee Report",
    description: "Active employees not yet enrolled on a punch machine.",
    perm: "reports.hr",
    filters: ["device", "org"],
    async run(f) {
      const emps = await loadEmployees(f, { devices: { none: { removedAt: null, ...(f.device ? { deviceId: f.device } : {}) } } });
      return {
        title: "Due Punch Machine Assign Employee Report",
        subtitle: `${emps.length} employees to enrol`,
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "punch", label: "Punch ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" },
            { key: "join", label: "Joined", fmt: "date" }, { key: "remark", label: "Enrolled on" },
          ],
          groups: groupBy(emps, secTitle, (e) => ({ code: e.empCode, punch: e.punchId, name: e.nameEn, desig: e.designation.nameEn, join: e.joinDate, remark: "" })),
          grandTotal: false,
        },
      };
    },
  },
  {
    slug: "device-delete",
    group: "Employee",
    title: "Delete Employee From Punch Machine Report",
    description: "Separated employees still enrolled on a punch machine — remove them to close physical access (C-TPAT).",
    perm: "reports.hr",
    filters: ["device", "org"],
    async run(f) {
      f.emp.status = "SEPARATED";
      const emps = await loadEmployees(f, { devices: { some: { removedAt: null, ...(f.device ? { deviceId: f.device } : {}) } } }, "ALL");
      const enr = await prisma.employeeDevice.findMany({ where: { employeeId: { in: emps.map((e) => e.id) }, removedAt: null }, include: { device: true } });
      return {
        title: "Delete Employee From Punch Machine Report",
        subtitle: `${emps.length} separated employees still enrolled`,
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "punch", label: "Punch ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" },
            { key: "last", label: "Last working day", fmt: "date" }, { key: "devices", label: "Enrolled on" },
          ],
          groups: groupBy(emps, secTitle, (e) => ({
            code: e.empCode, punch: e.punchId, name: e.nameEn, desig: e.designation.nameEn, last: e.separationDate,
            devices: enr.filter((x) => x.employeeId === e.id).map((x) => x.device.name).join(", "),
          })),
          grandTotal: false,
        },
      };
    },
  },
  {
    slug: "worker-register",
    group: "Employee",
    title: "Worker Register (Form 8)",
    titleBn: "শ্রমিক রেজিস্টার — ফরম ৮",
    description: "Statutory worker register (s.9, Rule 23).",
    perm: "reports.hr",
    filters: ["org", "type", "status"],
    async run(f, { company }) {
      const emps = await loadEmployees(f);
      const weekly = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return {
        title: "Worker Register — Form 8",
        titleBn: "শ্রমিক রেজিস্টার (ধারা ৯, বিধি ২৩)",
        subtitle: `Registration no. ${company.licenseNo || "—"}`,
        layout: "legall",
        table: {
          serial: true,
          columns: [
            { key: "name", label: "Name & NID" }, { key: "father", label: "Father" }, { key: "mother", label: "Mother" }, { key: "sex", label: "Sex, DOB & age" },
            { key: "addr", label: "Permanent address" }, { key: "join", label: "Appointed", fmt: "date" }, { key: "desig", label: "Designation & grade" },
            { key: "code", label: "Card no." }, { key: "hours", label: "Working period" }, { key: "break", label: "Break" }, { key: "weekly", label: "Weekly holiday" },
            { key: "group", label: "Group / section" }, { key: "shift", label: "Shift" }, { key: "remark", label: "Remarks" },
          ],
          groups: [
            {
              rows: emps.map((e) => ({
                name: `${e.nameEn}\n${e.nidNo}`, father: e.fatherEn, mother: e.motherEn, sex: `${label(GENDERS, e.gender)}, ${dmy(e.dob)}, ${ageOn(e.dob, new Date(e.joinDate))}`,
                addr: enAddress(e, "perm"), join: e.joinDate, desig: `${e.designation.nameEn}${e.grade ? ` / ${e.grade.nameEn}` : ""}`, code: e.empCode,
                hours: `${e.shift.inTime}–${e.shift.outTime}`, break: `${e.shift.breakMinutes} min`, weekly: weekly[e.weeklyHoliday ?? company.weeklyHoliday],
                group: e.section.nameEn, shift: e.shift.code, remark: e.status === "SEPARATED" ? `Left ${dmy(e.separationDate)}` : "",
              })),
            },
          ],
        },
      };
    },
  },
];

function Cells({ k, v }: { k: string; v: unknown }) {
  return (
    <>
      <td className="w-[22%] bg-neutral-50 font-medium">{k}</td>
      <td className={`w-[28%] ${/[ঀ-৿]/.test(String(v ?? "")) ? "font-bn" : ""}`}>{v === null || v === undefined ? "" : String(v)}</td>
    </>
  );
}

function rollup<T>(items: T[], key: (t: T) => string, agg: (list: T[]) => Row): Row[] {
  const m = new Map<string, T[]>();
  for (const it of items) m.set(key(it), [...(m.get(key(it)) ?? []), it]);
  return [...m.entries()].map(([unit, list]) => ({ unit, ...agg(list) }));
}

function summaryReport(slug: string, title: string, description: string, level: "section" | "department"): ReportDef {
  return {
    slug,
    group: "Employee",
    title,
    description,
    perm: "reports.hr",
    filters: ["org"],
    async run(f, { user }) {
      const emps = await loadEmployees(f);
      const salary = can(user, "salary.view");
      const rows = rollup(emps, level === "section" ? secTitle : (e) => e.department.nameEn, (list) => ({
        total: list.length,
        male: list.filter((e) => e.gender === "MALE").length,
        female: list.filter((e) => e.gender === "FEMALE").length,
        WORKER: list.filter((e) => e.empType === "WORKER").length,
        STAFF: list.filter((e) => e.empType === "STAFF").length,
        MANAGEMENT: list.filter((e) => e.empType === "MANAGEMENT").length,
        gross: round2(list.reduce((s, e) => s + e.gross, 0)),
      }));
      return {
        title,
        table: {
          serial: true,
          columns: [
            { key: "unit", label: level === "section" ? "Department › Section" : "Department" },
            { key: "male", label: "Male", fmt: "int", total: true },
            { key: "female", label: "Female", fmt: "int", total: true },
            { key: "WORKER", label: "Workers", fmt: "int", total: true },
            { key: "STAFF", label: "Staff", fmt: "int", total: true },
            { key: "MANAGEMENT", label: "Management", fmt: "int", total: true },
            { key: "total", label: "Total", fmt: "int", total: true },
            ...(salary ? [{ key: "gross", label: "Monthly gross", fmt: "money0", total: true } as Col] : []),
          ],
          groups: [{ rows }],
        },
      };
    },
  };
}
