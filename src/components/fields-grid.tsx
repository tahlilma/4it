"use client";

import type { MasterField } from "@/lib/masters";
import { CheckField, Field, SelectField, TextArea } from "./form";

export type FieldValue = string | number | boolean | null;

/** Renders inputs for a config-defined field list inside an ActionForm. */
export function FieldsGrid({
  fields,
  values,
  refs = {},
  cols = 2,
}: {
  fields: MasterField[];
  values: Record<string, FieldValue> | null;
  refs?: Record<string, { value: number; label: string }[]>;
  cols?: 2 | 3 | 4;
}) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <div className={`grid grid-cols-1 gap-3 ${grid}`}>
      {fields.map((f) => {
        const dflt = values ? values[f.name] : (f.default ?? null);
        switch (f.type) {
          case "bool":
            return <CheckField key={f.name} name={f.name} label={f.label} defaultChecked={Boolean(dflt)} hint={f.hint} className="sm:col-span-full" />;
          case "textarea":
            return <TextArea key={f.name} name={f.name} label={f.label} defaultValue={(dflt as string) ?? ""} className="sm:col-span-full" />;
          case "select":
            return (
              <SelectField key={f.name} name={f.name} label={f.label} required={f.required} hint={f.hint}
                options={(f.options ?? []).map((o) => ({ value: o.value, label: o.en }))}
                defaultValue={dflt === null || dflt === undefined ? null : String(dflt)} placeholder={f.required ? undefined : "—"} />
            );
          case "ref":
            return (
              <SelectField key={f.name} name={f.name} label={f.label} required={f.required} hint={f.hint}
                options={refs[f.ref!] ?? []} defaultValue={dflt as number | null} placeholder="— Select —" />
            );
          default:
            return (
              <Field key={f.name} name={f.name} label={f.label} required={f.required} hint={f.hint}
                type={f.type === "number" || f.type === "int" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : "text"}
                step={f.type === "number" ? "0.01" : f.type === "int" ? "1" : undefined}
                lang={f.bn ? "bn" : undefined}
                defaultValue={dflt as string | number | null} />
            );
        }
      })}
    </div>
  );
}
