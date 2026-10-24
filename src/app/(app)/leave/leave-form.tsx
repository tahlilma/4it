"use client";

import { ActionForm, CheckField, Field, FormMessage, SelectField, Submit, TextArea } from "@/components/form";
import { createLeave } from "./actions";

export function LeaveForm({ types, today, canApprove, emp }: { types: { value: number; label: string }[]; today: string; canApprove: boolean; emp?: string }) {
  return (
    <ActionForm action={createLeave} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="emp" label="Employee ID" required defaultValue={emp} />
        <SelectField name="leaveTypeId" label="Leave type" options={types} placeholder="— Select —" required />
        <Field name="from" label="From" type="date" required defaultValue={today} />
        <Field name="to" label="To" type="date" required defaultValue={today} />
        <Field name="days" label="Days" type="number" step="0.5" hint="Blank = all calendar days (r.106)" />
        <Field name="appliedOn" label="Applied on" type="date" defaultValue={today} />
      </div>
      <TextArea name="reason" label="Reason" rows={2} />
      {canApprove && <CheckField name="approve" label="Approve now" defaultChecked />}
      <FormMessage />
      <Submit>Save application</Submit>
    </ActionForm>
  );
}
