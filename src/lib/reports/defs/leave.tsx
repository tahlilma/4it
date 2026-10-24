import { CompanyHeader, Sheet } from "@/components/report/sheet";
import { INCREMENT_KINDS, label } from "../../constants";
import { dmy, maxDate, minDate, utcDate } from "../../dates";
import { prisma } from "../../db";
import { inChunks } from "../../chunk";
import { employeeWhere } from "../../employee-filter";
import { round2 } from "../../num";
import { leaveBalances } from "../../services/leave";
import { lastIncrementDates } from "../../services/increment";
import type { ReportDef, Row } from "../types";
import { groupBy, loadEmployees, secTitle } from "../util";

export const leaveReports: ReportDef[] = [
  {
    slug: "leave-register",
    group: "Leave",
    title: "Leave Register (Form 9)",
    titleBn: "ছুটির রেজিস্টার ও ছুটির বহি — ফরম ৯",
    description: "Statutory register of leave and leave book (s.10, Rule 24, Rule 108): applications, days granted and balances per employee for a year.",
    perm: "reports.hr",
    filters: ["year", "emp", "org", "status"],
    async run(f, { company, today }) {
      const emps = await loadEmployees(f);
      const yStart = utcDate(f.year, 1, 1), yEnd = utcDate(f.year, 12, 31);
      const asOf = yEnd < today ? yEnd : today;
      const ids = emps.map((e) => e.id);
      const [opening, current, apps, enc] = await Promise.all([
        leaveBalances(prisma, ids, f.year - 1, utcDate(f.year - 1, 12, 31)),
        leaveBalances(prisma, ids, f.year, asOf),
        inChunks(ids, (slice) => prisma.leaveApplication.findMany({ where: { employeeId: { in: slice }, fromDate: { lte: yEnd }, toDate: { gte: yStart } }, include: { leaveType: true }, orderBy: { fromDate: "asc" } })),
        prisma.elEncashLine.findMany({ where: { employeeId: { in: ids }, run: { status: "POSTED", asOfDate: { gte: yStart, lte: yEnd } } }, include: { run: true } }),
      ]);
      return {
        title: "Leave Register",
        empty: emps.length ? undefined : "No employees.",
        node: emps.map((e, i) => {
          const elOpen = opening.get(e.id)?.find((b) => b.accrual === "EARNED")?.balance ?? 0;
          const cur = current.get(e.id) ?? [];
          let el = elOpen;
          let cl = cur.find((b) => b.code === "CL")?.entitlement ?? 0;
          let sl = cur.find((b) => b.code === "SL")?.entitlement ?? 0;
          type Line = { date: Date; type: string; note: string; granted: Date | null; a: number; c: number; s: number; cash: string };
          const lines: Line[] = [];
          for (const a of apps.filter((x) => x.employeeId === e.id)) {
            const days = a.status === "APPROVED" ? a.days : 0;
            lines.push({
              date: a.appliedOn, type: `${a.leaveType.code} ${dmy(a.fromDate)}–${dmy(a.toDate)}`,
              note: a.status === "APPROVED" ? "" : `${a.status.toLowerCase()}${a.decisionNote ? `: ${a.decisionNote}` : ""}`,
              granted: a.status === "APPROVED" ? a.decidedAt : null,
              a: a.leaveType.code === "EL" ? days : 0, c: a.leaveType.code === "CL" ? days : 0, s: a.leaveType.code === "SL" ? days : 0, cash: "",
            });
          }
          for (const x of enc.filter((x) => x.employeeId === e.id)) {
            lines.push({ date: x.run.asOfDate, type: "EL encashment", note: "", granted: null, a: 0, c: 0, s: 0, cash: `${x.encashDays} d (${dmy(x.run.asOfDate)})` });
          }
          lines.sort((p, q) => p.date.getTime() - q.date.getTime());
          return (
            <Sheet key={e.id} layout="a4l" last={i === emps.length - 1}>
              <CompanyHeader company={company} title={`Register of Leave and Leave Book — Form 9 (${f.year})`} titleBn="ছুটির রেজিস্টার ও ছুটির বহি" />
              <div className="mb-2 grid grid-cols-3 gap-1 text-[11px]">
                <div>Name: <b>{e.nameEn}</b></div>
                <div>Card no.: {e.empCode}</div>
                <div>Designation: {e.designation.nameEn}</div>
                <div>Section: {secTitle(e)}</div>
                <div>Appointed: {dmy(e.joinDate)}</div>
                <div>Annual leave at start of year: <b>{elOpen}</b> days</div>
              </div>
              <table className="dt">
                <thead>
                  <tr>
                    <th rowSpan={2}>Applied</th>
                    <th rowSpan={2}>Leave requested</th>
                    <th rowSpan={2}>If refused / pending, reason</th>
                    <th rowSpan={2}>Date granted</th>
                    <th colSpan={3}>Days granted</th>
                    <th rowSpan={2}>Annual leave encashed & date</th>
                    <th colSpan={3}>Remaining due</th>
                    <th rowSpan={2}>Worker&apos;s signature</th>
                    <th rowSpan={2}>Employer&apos;s signature</th>
                  </tr>
                  <tr>
                    <th>Annual</th>
                    <th>Casual</th>
                    <th>Sick</th>
                    <th>Annual</th>
                    <th>Casual</th>
                    <th>Sick</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, k) => {
                    el = round2(el - l.a - (l.cash ? Number(l.cash.split(" ")[0]) : 0));
                    cl = round2(cl - l.c);
                    sl = round2(sl - l.s);
                    return (
                      <tr key={k}>
                        <td className="center">{dmy(l.date)}</td>
                        <td>{l.type}</td>
                        <td>{l.note}</td>
                        <td className="center">{dmy(l.granted)}</td>
                        <td className="num">{l.a || ""}</td>
                        <td className="num">{l.c || ""}</td>
                        <td className="num">{l.s || ""}</td>
                        <td>{l.cash}</td>
                        <td className="num">{el}</td>
                        <td className="num">{cl}</td>
                        <td className="num">{sl}</td>
                        <td />
                        <td />
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={13} className="center">
                        No leave taken in {f.year}. Entitlement: casual {cl}, sick {sl} days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-[10px]">Casual 10 days (s.115) and sick 14 days (s.116) per calendar year, pro-rata for joiners (r.106); earned leave 1 day per 18 days worked (s.117).</p>
            </Sheet>
          );
        }),
      };
    },
  },
  {
    slug: "leave-details",
    group: "Leave",
    title: "Leave Details Report",
    description: "Approved leave overlapping a date range.",
    perm: "reports.hr",
    filters: ["range", "leaveType", "org", "status"],
    defaults: { status: "ALL" },
    async run(f) {
      const apps = await prisma.leaveApplication.findMany({
        where: { status: "APPROVED", fromDate: { lte: f.to }, toDate: { gte: f.from }, ...(f.leaveType ? { leaveTypeId: f.leaveType } : {}), employee: employeeWhere(f.emp, { defaultStatus: "ALL" }) },
        include: { leaveType: true, employee: { include: { department: true, section: true, designation: true } } },
        orderBy: [{ employee: { department: { sortOrder: "asc" } } }, { employee: { empCode: "asc" } }, { fromDate: "asc" }],
      });
      return {
        title: "Leave Details Report",
        subtitle: `${dmy(f.from)} – ${dmy(f.to)}`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "type", label: "Leave" },
            { key: "from", label: "From", fmt: "date" }, { key: "to", label: "To", fmt: "date" }, { key: "days", label: "Days", fmt: "num", total: true },
            { key: "inRange", label: "Days in range", fmt: "num", total: true }, { key: "reason", label: "Reason" }, { key: "by", label: "Approved by" },
          ],
          groups: groupBy(apps, (a) => secTitle(a.employee), (a) => {
            const s = maxDate(a.fromDate, f.from), e = minDate(a.toDate, f.to);
            return {
              code: a.employee.empCode, name: a.employee.nameEn, desig: a.employee.designation.nameEn, type: a.leaveType.code, from: a.fromDate, to: a.toDate,
              days: a.days, inRange: Math.round((e.getTime() - s.getTime()) / 86400000) + 1, reason: a.reason, by: a.decidedBy,
            };
          }),
        },
      };
    },
  },
  {
    slug: "leave-balances",
    group: "Leave",
    title: "Leave Balances Report",
    description: "Casual, sick and earned leave entitlement, availed and balance per employee.",
    perm: "reports.hr",
    filters: ["year", "emp", "org", "type"],
    async run(f, { today }) {
      const emps = await loadEmployees(f);
      const asOf = f.year < today.getUTCFullYear() ? utcDate(f.year, 12, 31) : today;
      const bal = await leaveBalances(prisma, emps.map((e) => e.id), f.year, asOf);
      const pick = (id: number, code: string) => bal.get(id)?.find((b) => b.code === code);
      return {
        title: "Leave Balances Report",
        subtitle: `${f.year} · as of ${dmy(asOf)}`,
        layout: "a4l",
        table: {
          serial: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "join", label: "Joined", fmt: "date" },
            { key: "clE", label: "CL ent.", fmt: "num" }, { key: "clA", label: "CL used", fmt: "num", total: true }, { key: "clB", label: "CL bal.", fmt: "num", total: true },
            { key: "slE", label: "SL ent.", fmt: "num" }, { key: "slA", label: "SL used", fmt: "num", total: true }, { key: "slB", label: "SL bal.", fmt: "num", total: true },
            { key: "elE", label: "EL earned", fmt: "num" }, { key: "elA", label: "EL used", fmt: "num", total: true }, { key: "elC", label: "EL cashed", fmt: "num", total: true },
            { key: "elB", label: "EL bal.", fmt: "num", total: true }, { key: "other", label: "Other leave used" },
          ],
          groups: groupBy(emps, secTitle, (e) => {
            const cl = pick(e.id, "CL"), sl = pick(e.id, "SL"), el = pick(e.id, "EL");
            const other = (bal.get(e.id) ?? []).filter((b) => b.accrual === "NONE" && b.availed > 0).map((b) => `${b.code} ${b.availed}`).join(", ");
            return {
              code: e.empCode, name: e.nameEn, join: e.joinDate, clE: cl?.entitlement, clA: cl?.availed, clB: cl?.balance, slE: sl?.entitlement, slA: sl?.availed, slB: sl?.balance,
              elE: el?.entitlement, elA: el?.availed, elC: el?.encashed, elB: el ? (el.eligible ? el.balance : `${el.balance}*`) : "", other,
            };
          }),
          notes: ["* Earned leave accrues from joining but can be taken or encashed only after one year of service (s.117)."],
        },
      };
    },
  },
  {
    slug: "increment-proposals",
    group: "Increment",
    title: "Increment Proposal List",
    description: "Proposed and approved increments / promotions awaiting application.",
    perm: "reports.salary",
    filters: ["org"],
    async run(f) {
      const incs = await prisma.increment.findMany({
        where: { status: { in: ["PROPOSED", "APPROVED"] }, employee: employeeWhere(f.emp) },
        include: { employee: { include: { department: true, section: true } }, oldDesignation: true, newDesignation: true, oldGrade: true, newGrade: true },
        orderBy: [{ employee: { department: { sortOrder: "asc" } } }, { employee: { empCode: "asc" } }],
      });
      const last = await lastIncrementDates(prisma, incs.map((i) => i.employeeId));
      return {
        title: "Increment Proposal List",
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "desig", label: "Designation" }, { key: "join", label: "Joined", fmt: "date" },
            { key: "last", label: "Last increment", fmt: "date" }, { key: "basic", label: "Basic", fmt: "money0" }, { key: "gross", label: "Gross", fmt: "money0", total: true },
            { key: "pct", label: "%", fmt: "num" }, { key: "amount", label: "Increase", fmt: "money0", total: true }, { key: "newGross", label: "New gross", fmt: "money0", total: true },
            { key: "eff", label: "Effective", fmt: "date" }, { key: "kind", label: "Type" }, { key: "status", label: "Status" }, { key: "rec", label: "Recommended by" },
          ],
          groups: groupBy(incs, (i) => secTitle(i.employee), (i) => ({
            code: i.employee.empCode, name: i.employee.nameEn, desig: i.oldDesignationId === i.newDesignationId ? i.oldDesignation.nameEn : `${i.oldDesignation.nameEn} → ${i.newDesignation.nameEn}`,
            join: i.employee.joinDate, last: last.get(i.employeeId) ?? null, basic: i.oldBasic, gross: i.oldGross, pct: i.percent, amount: i.amount, newGross: i.newGross,
            eff: i.effectiveDate, kind: label(INCREMENT_KINDS, i.kind), status: i.status.toLowerCase(), rec: "",
          })),
        },
        signatures: ["Prepared by (HR)", "Head of department", "Manager (HR & Compliance)", "Approved by"],
      };
    },
  },
  {
    slug: "increment-list",
    group: "Increment",
    title: "Increment List",
    description: "Increments and promotions applied with an effective date in the range.",
    perm: "reports.salary",
    filters: ["range", "org"],
    async run(f) {
      const incs = await prisma.increment.findMany({
        where: { status: "APPLIED", effectiveDate: { gte: f.from, lte: f.to }, employee: employeeWhere(f.emp, { defaultStatus: "ALL" }) },
        include: { employee: { include: { department: true, section: true } }, oldDesignation: true, newDesignation: true },
        orderBy: [{ employee: { department: { sortOrder: "asc" } } }, { employee: { empCode: "asc" } }],
      });
      return {
        title: "Increment List",
        subtitle: `Effective ${dmy(f.from)} – ${dmy(f.to)}`,
        layout: "a4l",
        table: {
          serial: true,
          subtotals: true,
          columns: [
            { key: "code", label: "ID" }, { key: "name", label: "Name" }, { key: "kind", label: "Type" }, { key: "eff", label: "Effective", fmt: "date" },
            { key: "desig", label: "Designation" }, { key: "oldGross", label: "Old gross", fmt: "money0", total: true }, { key: "newGross", label: "New gross", fmt: "money0", total: true },
            { key: "amount", label: "Increase", fmt: "money0", total: true }, { key: "pct", label: "%", fmt: "num" },
          ],
          groups: groupBy(incs, (i) => secTitle(i.employee), (i): Row => ({
            code: i.employee.empCode, name: i.employee.nameEn, kind: label(INCREMENT_KINDS, i.kind), eff: i.effectiveDate,
            desig: i.oldDesignationId === i.newDesignationId ? i.newDesignation.nameEn : `${i.oldDesignation.nameEn} → ${i.newDesignation.nameEn}`,
            oldGross: i.oldGross, newGross: i.newGross, amount: i.amount, pct: i.percent,
          })),
        },
      };
    },
  },
];
