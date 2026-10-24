"use client";

import { ActionForm, CheckField, Field, FormMessage, SelectField, Submit, TextArea } from "@/components/form";
import { addManualPunch, deviceAction, importFile, processRange, saveAdjust } from "./actions";

export function ProcessForm({ from, to, departments }: { from: string; to: string; departments: { value: number; label: string }[] }) {
  return (
    <ActionForm action={processRange} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field name="from" label="From" type="date" defaultValue={from} required />
        <Field name="to" label="To" type="date" defaultValue={to} required />
        <SelectField name="dept" label="Department" options={departments} placeholder="All departments" />
      </div>
      <FormMessage />
      <Submit>Process attendance</Submit>
    </ActionForm>
  );
}

export function ImportForm() {
  return (
    <ActionForm action={importFile} className="space-y-3">
      <div>
        <label className="label">Punch log file</label>
        <input type="file" name="file" accept=".dat,.txt,.csv,.tsv" className="input" />
        <p className="mt-1 text-xs text-stone-500">ZKTeco attlog (*_attlog.dat) or CSV with punch ID and date-time per line.</p>
      </div>
      <CheckField name="process" label="Re-process attendance for the dates in the file" defaultChecked />
      <FormMessage />
      <Submit>Import</Submit>
    </ActionForm>
  );
}

export function ManualPunchForm({ emp, date }: { emp?: string; date: string }) {
  return (
    <ActionForm action={addManualPunch} resetOnSuccess className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="emp" label="Employee ID" defaultValue={emp} required />
        <Field name="date" label="Attendance date" type="date" defaultValue={date} required />
        <Field name="inTime" label="In time" type="time" />
        <Field name="outTime" label="Out time" type="time" hint="Earlier than in-time = next day" />
      </div>
      <TextArea name="reason" label="Reason" required rows={2} placeholder="e.g. Device 1 was offline 07:30–09:00 (IT ticket 123)" />
      <FormMessage />
      <Submit>Add manual punch</Submit>
    </ActionForm>
  );
}

export function AdjustForm({ emp, date }: { emp?: string; date: string }) {
  return (
    <ActionForm action={saveAdjust} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="emp" label="Employee ID" defaultValue={emp} required />
        <Field name="date" label="Attendance date" type="date" defaultValue={date} required />
        <SelectField
          name="status"
          label="Mark as"
          options={[
            { value: "PRESENT", label: "Present — official duty / outside work" },
            { value: "ABSENT", label: "Absent" },
          ]}
          defaultValue="PRESENT"
        />
        <div className="grid grid-cols-2 gap-2">
          <Field name="adjIn" label="In (optional)" type="time" />
          <Field name="adjOut" label="Out (optional)" type="time" />
        </div>
      </div>
      <TextArea name="reason" label="Reason" required rows={2} placeholder="e.g. Sent to buyer office for inspection (approved by PM)" />
      <FormMessage />
      <Submit>Save adjustment</Submit>
    </ActionForm>
  );
}

const OPS: [string, string, string?][] = [
  ["info", "Test connection"],
  ["pull", "Pull punches"],
  ["clock", "Sync clock"],
  ["enroll", "Enrol new employees", "Enrol every active employee who is not yet on this device?"],
  ["remove", "Remove separated", "Delete separated employees from this device?"],
  ["reconcile", "Read device users"],
];

export function DeviceActions({ deviceId }: { deviceId: number }) {
  return (
    <ActionForm action={deviceAction} className="space-y-2">
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="flex flex-wrap gap-1.5">
        {OPS.map(([op, label]) => (
          <Submit key={op} name="op" value={op} variant={op === "pull" ? "primary" : "secondary"} size="sm">
            {label}
          </Submit>
        ))}
      </div>
      <FormMessage />
    </ActionForm>
  );
}
