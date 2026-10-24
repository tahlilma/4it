"use client";

import { ActionForm, CheckField, Field, FormMessage, SelectField, Submit, TextArea } from "@/components/form";
import { SEPARATION_TYPES } from "@/lib/constants";
import { createMaternityCase, createSeparation, markSettlementPaid, recalcSettlement, reinstate, updateLeftyCase, updateMaternityCase } from "./actions";

export function SeparationForm({ emp, today }: { emp?: string; today: string }) {
  return (
    <ActionForm action={createSeparation} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="emp" label="Employee ID" defaultValue={emp} required />
        <SelectField name="type" label="Separation type" options={SEPARATION_TYPES.map((t) => ({ value: t.value, label: t.en }))} defaultValue="RESIGNATION" required />
        <Field name="noticeDate" label="Notice / resignation letter date" type="date" />
        <Field name="effectiveDate" label="Last working day" type="date" defaultValue={today} required />
        <Field name="noticeDays" label="Notice days given" type="number" hint="Blank = days between notice and last day" />
        <CheckField name="diedOnDuty" label="Death on duty / work accident (s.19: 45 days per year)" className="sm:col-span-2" />
      </div>
      <TextArea name="reason" label="Reason" rows={2} required />
      <FormMessage />
      <Submit variant="danger">Record separation & calculate settlement</Submit>
    </ActionForm>
  );
}

export function RecalcForm({ id, otherAddition, otherDeduction, remarks }: { id: number; otherAddition: number; otherDeduction: number; remarks: string }) {
  return (
    <ActionForm action={recalcSettlement} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field name="otherAddition" label="Other payable (Tk)" type="number" step="0.01" defaultValue={otherAddition} />
        <Field name="otherDeduction" label="Other deduction (Tk)" type="number" step="0.01" defaultValue={otherDeduction} />
        <Field name="benefitDays" label="Override benefit days" type="number" step="0.5" hint="Blank = statutory" />
      </div>
      <TextArea name="remarks" label="Remarks" rows={2} defaultValue={remarks} />
      <FormMessage />
      <Submit>Recalculate</Submit>
    </ActionForm>
  );
}

export function PaidForm({ id, today }: { id: number; today: string }) {
  return (
    <ActionForm action={markSettlementPaid} confirm="Record this settlement as paid? It can't be recalculated afterwards." confirmLabel="Mark as Paid" className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field name="paidOn" label="Paid on" type="date" defaultValue={today} required />
      <FormMessage />
      <Submit variant="success">Mark as Paid</Submit>
    </ActionForm>
  );
}

export function ReinstateForm({ id }: { id: number }) {
  return (
    <ActionForm action={reinstate} confirm="Withdraw this separation and reactivate the employee?" confirmLabel="Withdraw" className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <TextArea name="reason" label="Reason for withdrawal" rows={2} required />
      <FormMessage />
      <Submit variant="secondary">Withdraw Separation</Submit>
    </ActionForm>
  );
}

export function LeftyStep({ id, op, label, today, variant = "secondary", confirm }: { id: number; op: string; label: string; today: string; variant?: "primary" | "secondary" | "danger" | "success"; confirm?: string }) {
  const needsDate = op.startsWith("letter");
  return (
    <ActionForm action={updateLeftyCase} confirm={confirm} confirmLabel={label} destructive={variant === "danger"} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      {needsDate && <input type="date" name="date" defaultValue={today} className="input w-36 py-1 text-[13px]" />}
      <Submit size="sm" variant={variant}>
        {label}
      </Submit>
      <FormMessage className="w-full" />
    </ActionForm>
  );
}

export function MaternityForm({ today }: { today: string }) {
  return (
    <ActionForm action={createMaternityCase} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="emp" label="Employee ID" required />
        <Field name="survivingChildren" label="Surviving children" type="number" defaultValue={0} required />
        <Field name="noticeDate" label="Notice date (Form 18)" type="date" defaultValue={today} required />
        <Field name="expectedDelivery" label="Expected delivery date" type="date" required />
        <Field name="wages3m" label="Wages of last 3 months" type="number" step="0.01" hint="Blank = from payslips" />
        <Field name="daysWorked3m" label="Days worked in those months" type="number" hint="Blank = from payslips" />
      </div>
      <CheckField name="createLeave" label="Create approved maternity leave (8 weeks before + 8 weeks after)" defaultChecked />
      <FormMessage />
      <Submit>Open maternity case</Submit>
    </ActionForm>
  );
}

export function MaternityStep({ id, op, label, today }: { id: number; op: string; label: string; today: string }) {
  return (
    <ActionForm action={updateMaternityCase} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      {op !== "close" && <input type="date" name="date" defaultValue={today} className="input w-36 py-1 text-xs" />}
      <Submit size="sm" variant="secondary">
        {label}
      </Submit>
      <FormMessage className="w-full text-xs" />
    </ActionForm>
  );
}
