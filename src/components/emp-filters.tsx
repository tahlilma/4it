import type { ReactNode } from "react";
import { EMP_TYPES, GENDERS, RELIGIONS } from "@/lib/constants";
import { str, type SP } from "@/lib/employee-filter";
import { orgOptions } from "@/lib/refs";

/** GET filter bar for employee-based lists (server component). */
export async function EmpFilterBar({ sp, action, children, show = ["q", "dept", "sec", "desig", "line", "type", "gender", "status"] }: { sp: SP; action: string; children?: ReactNode; show?: string[] }) {
  const o = await orgOptions();
  const has = (k: string) => show.includes(k);
  const sel = (name: string, label: string, opts: { value: string | number; label: string }[], all = "All") => (
    <div>
      <label className="label">{label}</label>
      <select name={name} defaultValue={str(sp[name])} className="input">
        <option value="">{all}</option>
        {opts.map((x) => (
          <option key={String(x.value)} value={String(x.value)}>
            {x.label}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <form method="get" action={action} className="no-print card grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
      {has("q") && (
        <div className="col-span-2">
          <label className="label">Search</label>
          <input name="q" defaultValue={str(sp.q)} placeholder="ID, name, NID or mobile" className="input" />
        </div>
      )}
      {has("dept") && sel("dept", "Department", o.departments)}
      {has("sec") && sel("sec", "Section", o.sections)}
      {has("desig") && sel("desig", "Designation", o.designations)}
      {has("line") && sel("line", "Line", o.lines)}
      {has("floor") && sel("floor", "Floor", o.floors)}
      {has("type") && sel("type", "Type", EMP_TYPES.map((t) => ({ value: t.value, label: t.en })))}
      {has("gender") && sel("gender", "Gender", GENDERS.map((t) => ({ value: t.value, label: t.en })))}
      {has("religion") && sel("religion", "Religion", RELIGIONS.map((t) => ({ value: t.value, label: t.en })))}
      {has("status") &&
        sel(
          "status",
          "Status",
          [
            { value: "SEPARATED", label: "Separated" },
            { value: "ALL", label: "All" },
          ],
          "Active",
        )}
      {children}
      <div className="flex items-end gap-2">
        <button type="submit" className="btn btn-primary">
          Apply
        </button>
        <a href={action} className="btn btn-ghost">
          Reset
        </a>
      </div>
    </form>
  );
}
