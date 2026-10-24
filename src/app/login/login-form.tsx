"use client";

import { useSearchParams } from "next/navigation";
import { ActionForm, Field, FormMessage, Submit } from "@/components/form";
import { Icon } from "@/components/icons";
import { loginAction } from "./actions";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  return (
    <ActionForm action={loginAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field name="username" label="Username" required autoFocus placeholder="e.g. admin" />
      <Field name="password" label="Password" type="password" required placeholder="••••••••" />
      <FormMessage />
      <Submit className="w-full py-2.5">
        Sign in <Icon name="arrow-right" strokeWidth={2.2} className="h-4 w-4" />
      </Submit>
    </ActionForm>
  );
}
