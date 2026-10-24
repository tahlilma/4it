import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/form";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dmy } from "@/lib/dates";
import { masterByKey, type MasterDef } from "@/lib/masters";
import { refOptions } from "@/lib/refs";
import { deleteMaster } from "../actions";
import { MasterForm } from "../master-form";

type Row = Record<string, unknown> & { id: number };

export default async function MasterPage({ params, searchParams }: { params: Promise<{ master: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("setup.manage");
  const { master } = await params;
  const sp = await searchParams;
  const def = masterByKey(master);
  if (!def) notFound();

  const model = (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<Row[]>; findUnique: (a: unknown) => Promise<Row | null> }>)[def.model];
  const rows = await model.findMany({ orderBy: def.orderBy });
  const refKeys = [...new Set(def.fields.filter((f) => f.type === "ref").map((f) => f.ref!))];
  const refs: Record<string, { value: number; label: string }[]> = {};
  for (const k of refKeys) refs[k] = await refOptions(k);

  const editId = sp.edit ? Number(sp.edit) : null;
  const editing = editId ? await model.findUnique({ where: { id: editId } }) : null;
  const values = editing ? toValues(def, editing) : null;
  const listFields = def.fields.filter((f) => f.list);

  return (
    <div className="space-y-5">
      <PageHeader title={def.title} subtitle={def.description} back={{ href: "/setup", label: "Master data" }} />
      {sp.saved && <Alert tone="green">Saved.{def.reprocessHint ? " Re-process attendance for the affected dates so reports reflect the change." : ""}</Alert>}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title={`${rows.length} ${def.title.toLowerCase()}`} className="xl:col-span-2" bodyClass="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                {listFields.map((f) => (
                  <th key={f.name}>{f.label}</th>
                ))}
                <th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={editId === r.id ? "bg-hue-blue/[0.08]" : ""}>
                  {listFields.map((f) => (
                    <td key={f.name} className={f.bn ? "font-bn" : ""}>
                      {cell(f.type, r[f.name], f.type === "ref" ? refs[f.ref!] : undefined, f.options)}
                    </td>
                  ))}
                  <td>
                    <div className="flex justify-end gap-1">
                      <Link href={`/setup/${def.key}?edit=${r.id}`} className="btn btn-secondary btn-sm">
                        Edit
                      </Link>
                      <ActionButton action={deleteMaster} label="Delete" variant="secondary" fields={{ _master: def.key, _id: r.id }} confirm={`Delete this ${def.singular.toLowerCase()}? Records that use it will block deletion.`} />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={listFields.length + 1} className="py-8 text-center text-stone-500">
                    Nothing here yet — add the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card title={editing ? `Edit ${def.singular.toLowerCase()}` : `Add ${def.singular.toLowerCase()}`}>
          <MasterForm def={def} refs={refs} values={values} editId={editing ? editing.id : null} />
        </Card>
      </div>
    </div>
  );
}

function toValues(def: MasterDef, r: Row): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const f of def.fields) {
    const v = r[f.name];
    out[f.name] = v instanceof Date ? v.toISOString().slice(0, 10) : (v as string | number | boolean | null);
  }
  return out;
}

function cell(type: string, v: unknown, refs?: { value: number; label: string }[], options?: { value: string; en: string }[]) {
  if (v === null || v === undefined || v === "") return <span className="text-stone-300">—</span>;
  if (type === "bool") return v ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>;
  if (type === "date" && v instanceof Date) return dmy(v);
  if (type === "ref") return refs?.find((o) => o.value === v)?.label ?? String(v);
  if (type === "select") return options?.find((o) => o.value === v)?.en ?? String(v);
  if (typeof v === "number") return v.toLocaleString("en-IN");
  return String(v);
}
