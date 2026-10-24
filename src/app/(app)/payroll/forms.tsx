"use client";

import { useState } from "react";
import { ActionForm, CheckField, Field, FormMessage, SelectField, Submit, TextArea } from "@/components/form";
import { ADJUST_KINDS, FESTIVALS, RELIGIONS } from "@/lib/constants";
import {
  addAdjustment, addAdvance, createBonusRun, createElRun, createPromotion, createRun, generateProposals, incrementBulk, lockRun, unlockRun,
} from "./actions";

export function CreateRunForm({ month }: { month: string }) {
  return (
    <ActionForm action={createRun} className="flex flex-wrap items-end gap-3">
      <Field name="month" label="Wage month" type="month" defaultValue={month} required />
      <Submit>Open Payroll</Submit>
      <FormMessage className="w-full" />
    </ActionForm>
  );
}

export function LockForm({ id, due }: { id: number; due: string }) {
  return (
    <ActionForm action={lockRun} confirm="Lock this payroll? Attendance, leave and adjustments for the month will be frozen." confirmLabel="Lock Payroll" className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Field name="paymentDate" label="Payment date" type="date" defaultValue={due} required hint="s.123: within 7 working days after the wage period" />
      <FormMessage />
      <Submit variant="success">Lock Payroll</Submit>
    </ActionForm>
  );
}

export function UnlockForm({ id }: { id: number }) {
  return (
    <ActionForm action={unlockRun} confirm="Unlock a locked payroll? This is recorded in the audit log." confirmLabel="Unlock" destructive className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <TextArea name="reason" label="Reason for unlocking" rows={2} required />
      <FormMessage />
      <Submit variant="danger">Unlock</Submit>
    </ActionForm>
  );
}

export function AdjustmentForm({ month }: { month: string }) {
  return (
    <ActionForm action={addAdjustment} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="month" label="Wage month" type="month" defaultValue={month} required />
        <Field name="emp" label="Employee ID" required />
        <SelectField name="kind" label="Type" options={ADJUST_KINDS.map((k) => ({ value: k.value, label: k.en }))} required defaultValue="ARREAR" />
        <Field name="amount" label="Amount (Tk)" type="number" step="0.01" required />
      </div>
      <TextArea name="reason" label="Reason" rows={2} required placeholder="Deductions must be lawful (s.125): e.g. recovery of excess payment" />
      <FormMessage />
      <Submit>Add</Submit>
    </ActionForm>
  );
}

export function AdvanceForm({ today, month }: { today: string; month: string }) {
  return (
    <ActionForm action={addAdvance} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="emp" label="Employee ID" required />
        <Field name="date" label="Date given" type="date" defaultValue={today} required />
        <Field name="amount" label="Amount (Tk)" type="number" step="0.01" required />
        <Field name="installments" label="Monthly instalments" type="number" defaultValue={3} required />
        <Field name="start" label="Recover from month" type="month" defaultValue={month} required />
      </div>
      <TextArea name="reason" label="Purpose" rows={2} />
      <FormMessage />
      <Submit>Record advance</Submit>
    </ActionForm>
  );
}

export function BonusRunForm({ today }: { today: string }) {
  return (
    <ActionForm action={createBonusRun} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="title" label="Title" required placeholder="Eid-ul-Fitr Bonus 2027" className="sm:col-span-2" />
        <SelectField name="festival" label="Festival" options={FESTIVALS.map((f) => ({ value: f.value, label: f.en }))} required defaultValue="EID_UL_FITR" />
        <SelectField name="basis" label="Bonus basis" options={[{ value: "BASIC", label: "Basic (r.111(5))" }, { value: "GROSS", label: "Gross" }]} defaultValue="BASIC" />
        <Field name="cutoffDate" label="Service counted up to" type="date" defaultValue={today} required />
        <Field name="paymentDate" label="Payment date" type="date" />
        <Field name="p12" label="% for ≥ 12 months' service" type="number" defaultValue={100} />
        <Field name="p6" label="% for 6–12 months (0 = none)" type="number" defaultValue={50} />
        <Field name="stamp" label="Revenue stamp (Tk)" type="number" defaultValue={0} />
      </div>
      <div>
        <div className="label">Religions (leave all unticked for everyone)</div>
        <div className="flex flex-wrap gap-3">
          {RELIGIONS.map((r) => (
            <label key={r.value} className="inline-flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="religions" value={r.value} className="h-4 w-4" /> {r.en}
            </label>
          ))}
        </div>
      </div>
      <FormMessage />
      <Submit>Create bonus sheet</Submit>
    </ActionForm>
  );
}

export function ProposalForm({ date, percent }: { date: string; percent: number }) {
  return (
    <ActionForm action={generateProposals} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="effectiveDate" label="Effective date" type="date" defaultValue={date} required />
        <Field name="percent" label="Increment % of basic" type="number" step="0.01" defaultValue={percent} required />
      </div>
      <CheckField name="all" label="Include everyone (not only those with 12 months since joining / last increment)" />
      <FormMessage />
      <Submit>Generate proposals</Submit>
    </ActionForm>
  );
}

export function PromotionForm({ designations, grades, date }: { designations: { value: number; label: string }[]; grades: { value: number; label: string }[]; date: string }) {
  return (
    <ActionForm action={createPromotion} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="emp" label="Employee ID" required />
        <SelectField name="kind" label="Type" options={[{ value: "PROMOTION", label: "Promotion" }, { value: "SPECIAL", label: "Special increment" }]} defaultValue="PROMOTION" />
        <SelectField name="designationId" label="New designation" options={designations} placeholder="Unchanged" />
        <SelectField name="gradeId" label="New grade" options={grades} placeholder="Unchanged" />
        <Field name="gross" label="New gross (Tk)" type="number" step="0.01" required />
        <Field name="effectiveDate" label="Effective date" type="date" defaultValue={date} required />
      </div>
      <TextArea name="remarks" label="Remarks" rows={2} />
      <FormMessage />
      <Submit>Create proposal</Submit>
    </ActionForm>
  );
}

export interface ProposalRow {
  id: number;
  status: string;
  code: string;
  name: string;
  kind: string;
  effective: string;
  oldDesig: string;
  newDesig: string;
  oldGross: string;
  newGross: string;
  amount: string;
  percent: number;
  empId: number;
}

export function ProposalTable({ rows, canApprove, canApply, total, view }: { rows: ProposalRow[]; canApprove: boolean; canApply: boolean; total: number; view: string }) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [everything, setEverything] = useState(false);
  const toggle = (id: number) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const all = rows.length > 0 && sel.size === rows.length;
  const more = all && total > rows.length;
  return (
    <ActionForm action={incrementBulk} className="space-y-2">
      {everything && more ? <input type="hidden" name="allView" value={view} /> : [...sel].map((id) => <input key={id} type="hidden" name="id" value={id} />)}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <span className="text-sm text-stone-500">{everything && more ? `All ${total} in this view selected` : `${sel.size} selected`}</span>
        {more && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEverything(!everything)}>
            {everything ? "Only this page" : `Select all ${total} in this view`}
          </button>
        )}
        {canApprove && (
          <>
            <Submit name="op" value="approve" variant="success" size="sm">
              Approve
            </Submit>
            <Submit name="op" value="reject" variant="secondary" size="sm">
              Reject
            </Submit>
          </>
        )}
        {canApply && (
          <Submit name="op" value="apply" variant="primary" size="sm">
            Apply approved to salary
          </Submit>
        )}
        <FormMessage className="w-full" />
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" aria-label="Select all on this page" checked={all} onChange={() => { setEverything(false); setSel(all ? new Set() : new Set(rows.map((r) => r.id))); }} />
              </th>
              <th>Employee</th>
              <th>Type</th>
              <th>Effective</th>
              <th>Designation</th>
              <th className="text-right">Current gross</th>
              <th className="text-right">New gross</th>
              <th className="text-right">Increase</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input type="checkbox" aria-label={`Select ${r.code}`} checked={sel.has(r.id)} onChange={() => { setEverything(false); toggle(r.id); }} />
                </td>
                <td>
                  <a className="link text-[13px] font-medium tabular-nums" href={`/employees/${r.empId}?tab=salary`}>
                    {r.code}
                  </a>
                  <div className="text-sm">{r.name}</div>
                </td>
                <td className="text-xs">{r.kind}</td>
                <td className="whitespace-nowrap text-sm">{r.effective}</td>
                <td className="text-xs">{r.oldDesig === r.newDesig ? r.oldDesig : `${r.oldDesig} → ${r.newDesig}`}</td>
                <td className="text-right tabular-nums">{r.oldGross}</td>
                <td className="text-right tabular-nums">{r.newGross}</td>
                <td className="text-right tabular-nums">
                  {r.amount}
                  <div className="text-xs text-stone-500">{r.percent}%</div>
                </td>
                <td className="text-xs">{r.status}</td>
                <td>
                  <a className="text-[12.5px] text-ink-blue hover:underline" href={`/reports/increment-letter?inc=${r.id}&run=1&status=ALL`}>
                    Letter
                  </a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-stone-500">
                  No proposals in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ActionForm>
  );
}

export function ElRunForm({ date, year }: { date: string; year: number }) {
  return (
    <ActionForm action={createElRun} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="title" label="Title" defaultValue={`Earned leave encashment ${year}`} required />
        <Field name="asOfDate" label="Balance as of" type="date" defaultValue={date} required />
      </div>
      <FormMessage />
      <Submit>Calculate encashment</Submit>
    </ActionForm>
  );
}
