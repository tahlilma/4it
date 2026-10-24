"use client";

import { useRef, useState } from "react";
import { ActionForm, Field, FormMessage, SelectField, Submit } from "@/components/form";
import { saveNominee, savePhoto, saveTeamMember } from "../actions";

/** Resizes the chosen image in the browser (passport size, ~300×360) before uploading. */
export function PhotoUpload({ id }: { id: number }) {
  const [data, setData] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const onFile = (f: File | undefined) => {
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const W = 300, H = 360;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.max(W / img.width, H / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      setData(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };
  return (
    <ActionForm action={savePhoto} className="min-w-0 flex-1 space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="photo" value={data} />
      <div ref={formRef} className="flex flex-wrap items-center gap-2">
        <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
        {data && (
          <Submit size="sm" variant="primary">
            Upload
          </Submit>
        )}
      </div>
      <p className="text-xs text-stone-400">Any photo — it&apos;s cropped to passport size (300 × 360) for the ID card.</p>
      <FormMessage />
    </ActionForm>
  );
}

export function NomineeForm({ employeeId, nominee }: { employeeId: number; nominee?: Record<string, string | number | null> }) {
  const v = (k: string) => nominee?.[k] ?? null;
  return (
    <ActionForm action={saveNominee} resetOnSuccess={!nominee} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      {nominee && <input type="hidden" name="id" value={String(nominee.id)} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field name="nameEn" label="Name (English)" defaultValue={v("nameEn") as string} />
        <Field name="nameBn" label="নাম (বাংলা)" lang="bn" defaultValue={v("nameBn") as string} />
        <Field name="relationEn" label="Relationship" defaultValue={v("relationEn") as string} />
        <Field name="relationBn" label="সম্পর্ক" lang="bn" defaultValue={v("relationBn") as string} />
        <Field name="age" label="Age" type="number" defaultValue={v("age") as number} />
        <Field name="nidNo" label="NID no." defaultValue={v("nidNo") as string} />
        <Field name="mobile" label="Mobile" defaultValue={v("mobile") as string} />
        <Field name="sharePercent" label="Share %" type="number" defaultValue={(v("sharePercent") as number) ?? 100} />
        <Field name="addressEn" label="Address (English)" defaultValue={v("addressEn") as string} className="lg:col-span-2" />
        <Field name="addressBn" label="ঠিকানা (বাংলা)" lang="bn" defaultValue={v("addressBn") as string} className="lg:col-span-2" />
      </div>
      <FormMessage />
      <Submit size="sm">{nominee ? "Save nominee" : "Add nominee"}</Submit>
    </ActionForm>
  );
}

export function TeamForm({ employeeId, teams }: { employeeId: number; teams: { value: number; label: string }[] }) {
  return (
    <ActionForm action={saveTeamMember} resetOnSuccess className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SelectField name="teamId" label="Team" options={teams} placeholder="— Select —" required />
        <SelectField name="role" label="Role" options={[{ value: "MEMBER", label: "Member" }, { value: "LEADER", label: "Team leader" }]} defaultValue="MEMBER" />
        <Field name="trainingDate" label="Training date" type="date" />
        <Field name="trainedBy" label="Trained by" placeholder="e.g. Fire Service & Civil Defence" />
        <Field name="certificateNo" label="Certificate no." />
      </div>
      <FormMessage />
      <Submit size="sm">Add to team</Submit>
    </ActionForm>
  );
}
