import { EMP_TYPES, GENDERS, PAYMENT_MODES, RELIGIONS } from "@/lib/constants";
import { monthKey, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { str } from "@/lib/employee-filter";
import { orgOptions } from "@/lib/refs";
import type { Filters, ReportDef } from "@/lib/reports/types";

const KEEP = ["case", "app", "inc"]; // context parameters passed through from other screens

export async function ReportFilters({ def, f }: { def: ReportDef; f: Filters }) {
  const has = (k: string) => (def.filters as string[]).includes(k);
  const o = has("org") || has("floor") || has("grade") || has("mtype") ? await orgOptions() : null;
  const [buyers, bonusRuns, elRuns, leaveTypes, teams, devices] = await Promise.all([
    has("buyer") ? prisma.buyer.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [],
    has("bonus") ? prisma.bonusRun.findMany({ orderBy: { cutoffDate: "desc" } }) : [],
    has("elrun") ? prisma.elEncashRun.findMany({ orderBy: { asOfDate: "desc" } }) : [],
    has("leaveType") ? prisma.leaveType.findMany({ orderBy: { sortOrder: "asc" } }) : [],
    has("team") ? prisma.team.findMany({ orderBy: { sortOrder: "asc" } }) : [],
    has("device") ? prisma.device.findMany({ orderBy: { name: "asc" } }) : [],
  ]);
  const sel = (name: string, label: string, opts: { value: string | number; label: string }[], value: string, all: string | null = "All") => (
    <div>
      <label className="label">{label}</label>
      <select name={name} defaultValue={value} className="input">
        {all !== null && <option value="">{all}</option>}
        {opts.map((x) => (
          <option key={String(x.value)} value={String(x.value)}>
            {x.label}
          </option>
        ))}
      </select>
    </div>
  );
  const sp = f.raw;
  return (
    <form method="get" className="no-print card grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
      <input type="hidden" name="run" value="1" />
      {KEEP.map((k) => (str(sp[k]) ? <input key={k} type="hidden" name={k} value={str(sp[k])} /> : null))}
      {has("date") && (
        <div>
          <label className="label">Date</label>
          <input type="date" name="date" defaultValue={ymd(f.date)} className="input" />
        </div>
      )}
      {has("range") && (
        <>
          <div>
            <label className="label">From</label>
            <input type="date" name="from" defaultValue={ymd(f.from)} className="input" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" name="to" defaultValue={ymd(f.to)} className="input" />
          </div>
        </>
      )}
      {has("month") && (
        <div>
          <label className="label">Month</label>
          <input type="month" name="month" defaultValue={monthKey(f.month.year, f.month.month)} className="input" />
        </div>
      )}
      {has("month2") && (
        <div>
          <label className="label">Compare with</label>
          <input type="month" name="month2" defaultValue={monthKey(f.month2.year, f.month2.month)} className="input" />
        </div>
      )}
      {has("year") && (
        <div>
          <label className="label">Year</label>
          <input type="number" name="year" defaultValue={f.year} className="input" />
        </div>
      )}
      {has("format") && def.formats && sel("format", "Format", def.formats, f.format, null)}
      {has("bonus") && sel("bonus", "Bonus sheet", bonusRuns.map((b) => ({ value: b.id, label: b.title })), String(f.bonus ?? bonusRuns[0]?.id ?? ""), null)}
      {has("elrun") && sel("elrun", "Encashment sheet", elRuns.map((b) => ({ value: b.id, label: `${b.title} (${b.status.toLowerCase()})` })), String(f.elrun ?? ""), "Live balance (not saved)")}
      {has("buyer") && sel("buyer", "Buyer limits", buyers.map((b) => ({ value: b.id, label: b.name })), String(f.buyer ?? ""), "Labour Act limits")}
      {has("leaveType") && sel("leaveType", "Leave type", leaveTypes.map((t) => ({ value: t.id, label: t.code })), String(f.leaveType ?? ""))}
      {has("team") && sel("team", "Team", teams.map((t) => ({ value: t.id, label: t.nameEn })), String(f.team ?? ""))}
      {has("device") && sel("device", "Device", devices.map((t) => ({ value: t.id, label: t.name })), String(f.device ?? ""), "Any device")}
      {has("letter") && sel("letter", "Letter", [{ value: 1, label: "1st letter" }, { value: 2, label: "2nd letter" }, { value: 3, label: "3rd letter" }], String(f.letter), null)}
      {has("address") && sel("address", "Address", [{ value: "both", label: "Present & permanent" }, { value: "pres", label: "Present" }, { value: "perm", label: "Permanent" }], f.address, null)}
      {has("minDays") && (
        <div>
          <label className="label">Minimum days</label>
          <input type="number" name="minDays" defaultValue={f.minDays || ""} className="input" />
        </div>
      )}
      {has("emp") && (
        <div className="col-span-2">
          <label className="label">Employee IDs</label>
          <input name="emp" defaultValue={str(sp.emp)} placeholder="e.g. 10001, 10002 (blank = all)" className="input" />
        </div>
      )}
      {o && has("org") && (
        <>
          {sel("dept", "Department", o.departments, str(sp.dept))}
          {sel("sec", "Section", o.sections, str(sp.sec))}
          {sel("desig", "Designation", o.designations, str(sp.desig))}
          {sel("line", "Line", o.lines, str(sp.line))}
        </>
      )}
      {o && has("floor") && sel("floor", "Floor", o.floors, str(sp.floor))}
      {o && has("grade") && sel("grade", "Grade", o.grades, str(sp.grade))}
      {o && has("mtype") && sel("mtype", "Machine type", o.machineTypes, str(sp.mtype))}
      {has("type") && sel("type", "Employee type", EMP_TYPES.map((t) => ({ value: t.value, label: t.en })), str(sp.type))}
      {has("gender") && sel("gender", "Gender", GENDERS.map((t) => ({ value: t.value, label: t.en })), str(sp.gender))}
      {has("religion") && sel("religion", "Religion", RELIGIONS.map((t) => ({ value: t.value, label: t.en })), str(sp.religion))}
      {has("pay") && sel("pay", "Payment mode", PAYMENT_MODES.map((t) => ({ value: t.value, label: t.en })), str(sp.pay))}
      {has("status") && sel("status", "Status", [{ value: "SEPARATED", label: "Separated" }, { value: "ALL", label: "All" }], f.emp.status === "ACTIVE" ? "" : f.emp.status ?? "", "Active")}
      <div className="flex items-end gap-2">
        <button type="submit" className="btn btn-primary">
          Show Report
        </button>
      </div>
    </form>
  );
}
