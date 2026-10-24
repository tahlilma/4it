"use client";

import Link from "next/link";
import { FieldsGrid, type FieldValue } from "@/components/fields-grid";
import { ActionForm, FormMessage, Submit } from "@/components/form";
import type { MasterDef } from "@/lib/masters";
import { saveMaster } from "./actions";

export function MasterForm({ def, refs, values, editId }: { def: MasterDef; refs: Record<string, { value: number; label: string }[]>; values: Record<string, FieldValue> | null; editId: number | null }) {
  return (
    <ActionForm action={saveMaster} resetOnSuccess={!editId} className="space-y-3" key={editId ?? "new"}>
      <input type="hidden" name="_master" value={def.key} />
      {editId && <input type="hidden" name="_id" value={editId} />}
      <FieldsGrid fields={def.fields} values={values} refs={refs} />
      <FormMessage />
      <div className="flex gap-2">
        <Submit>{editId ? "Save changes" : `Add ${def.singular.toLowerCase()}`}</Submit>
        {editId && (
          <Link href={`/setup/${def.key}`} className="btn btn-secondary">
            Cancel
          </Link>
        )}
      </div>
    </ActionForm>
  );
}
