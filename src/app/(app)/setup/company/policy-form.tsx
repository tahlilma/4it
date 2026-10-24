"use client";

import { FieldsGrid, type FieldValue } from "@/components/fields-grid";
import { ActionForm, FormMessage, Submit } from "@/components/form";
import type { PolicySection } from "@/lib/policy-fields";
import { savePolicy } from "./actions";

export function PolicyForm({ sections, values }: { sections: PolicySection[]; values: Record<string, FieldValue> }) {
  return (
    <ActionForm action={savePolicy} className="space-y-5">
      {sections.map((s) => (
        <section key={s.title} className="card">
          <div className="card-h">
            <h2 className="text-[17px] leading-6 font-semibold tracking-[-0.016em] text-label">{s.title}</h2>
          </div>
          <div className="space-y-3 px-5 pb-5">
            {s.note && <p className="text-xs leading-relaxed text-stone-500">{s.note}</p>}
            <FieldsGrid fields={s.fields} values={values} cols={s.fields.length > 6 ? 3 : 2} />
          </div>
        </section>
      ))}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+84px)] z-10 flex items-center gap-3 rounded-[20px] material material-edge px-3 py-2.5 lg:bottom-4">
        <Submit>Save Policy</Submit>
        <FormMessage className="flex-1" />
      </div>
    </ActionForm>
  );
}
