"use client";

import Link from "next/link";
import { ActionForm, CheckField, Field, FormMessage, SelectField, Submit } from "@/components/form";
import { ROLES } from "@/lib/constants";
import { changeOwnPassword, createUser, updateUser } from "./actions";

const roleOptions = ROLES.map((r) => ({ value: r.value, label: r.en }));

export function NewUserForm() {
  return (
    <ActionForm action={createUser} resetOnSuccess className="space-y-3">
      <Field name="username" label="Username" required />
      <Field name="name" label="Full name" required />
      <SelectField name="role" label="Role" options={roleOptions} defaultValue="VIEWER" required />
      <Field name="password" label="Initial password" type="password" required hint="At least 8 characters with letters and numbers." />
      <FormMessage />
      <Submit>Create user</Submit>
    </ActionForm>
  );
}

export function EditUserForm({ user }: { user: { id: number; username: string; name: string; role: string; active: boolean } }) {
  return (
    <ActionForm action={updateUser} className="space-y-3">
      <input type="hidden" name="id" value={user.id} />
      <div className="text-sm text-stone-500">
        Username: <b className="text-stone-800">{user.username}</b>
      </div>
      <Field name="name" label="Full name" defaultValue={user.name} required />
      <SelectField name="role" label="Role" options={roleOptions} defaultValue={user.role} required />
      <CheckField name="active" label="Active (can sign in)" defaultChecked={user.active} />
      <Field name="password" label="Reset password (optional)" type="password" hint="Leave blank to keep the current password. Resetting signs the user out." />
      <FormMessage />
      <div className="flex gap-2">
        <Submit>Save</Submit>
        <Link href="/setup/users" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </ActionForm>
  );
}

export function OwnPasswordForm() {
  return (
    <ActionForm action={changeOwnPassword} resetOnSuccess className="space-y-3">
      <Field name="current" label="Current password" type="password" required />
      <Field name="next" label="New password" type="password" required />
      <FormMessage />
      <Submit variant="secondary">Change my password</Submit>
    </ActionForm>
  );
}
