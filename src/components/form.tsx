"use client";

import { createContext, startTransition, use, useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { Alert, cx } from "./ui";

export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}
export type FormAction = (prev: FormState | null, fd: FormData) => Promise<FormState>;

const Ctx = createContext<{ state: FormState | null; pending: boolean }>({ state: null, pending: false });

/**
 * Form bound to a server action. Submissions are dispatched manually so a failed validation keeps
 * what the user typed (React resets uncontrolled fields after `action`-prop submissions).
 * `confirm` asks first, in an Apple-style alert: "Question? Explanation." becomes title + message.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  confirmLabel = "Continue",
  destructive = false,
  id,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  confirmLabel?: string;
  destructive?: boolean;
  id?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const held = useRef<FormData | null>(null);
  const titleId = useId();
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  const split = confirm?.match(/^([^?]*\?)\s+([\s\S]+)$/);
  const title = split ? split[1] : confirm;
  const message = split?.[2];
  return (
    <Ctx value={{ state, pending }}>
      <form
        ref={ref}
        id={id}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          if (confirm) {
            held.current = fd;
            dialog.current?.showModal();
            return;
          }
          startTransition(() => dispatch(fd));
        }}
      >
        {children}
      </form>
      {confirm && (
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          onClose={() => (held.current = null)}
          className="alert m-auto w-[min(340px,calc(100vw-48px))] rounded-[22px] bg-elevated p-0 text-label shadow-[0_24px_60px_-12px_rgb(0_0_0/0.45)]"
        >
          <div className="px-6 pt-5 pb-4 text-center">
            <h2 id={titleId} className="text-[17px] leading-snug font-semibold tracking-[-0.016em]">
              {title}
            </h2>
            {message && <p className="mt-1.5 text-[13px] leading-snug text-label-2">{message}</p>}
          </div>
          <div className="flex gap-2 px-4 pb-4">
            <button type="button" className="btn btn-secondary flex-1 py-2" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button
              type="button"
              data-confirm
              autoFocus
              className={cx("btn flex-1 py-2", destructive ? "bg-hue-red text-white hover:brightness-[1.08]" : "btn-primary")}
              onClick={() => {
                const fd = held.current;
                dialog.current?.close();
                if (fd) startTransition(() => dispatch(fd));
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </dialog>
      )}
    </Ctx>
  );
}

export function useFormCtx() {
  return use(Ctx);
}

export function FormMessage({ className }: { className?: string }) {
  const { state } = use(Ctx);
  if (!state || (!state.error && !state.message)) return null;
  return (
    <div role={state.error ? "alert" : "status"} className={className}>
      {state.error ? <Alert tone="red">{state.error}</Alert> : <Alert tone="green">{state.message}</Alert>}
    </div>
  );
}

function Spinner() {
  return <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80" />;
}

export function Submit({
  children,
  variant = "primary",
  name,
  value,
  className,
  size,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "success";
  name?: string;
  value?: string;
  className?: string;
  size?: "sm";
}) {
  const { pending } = use(Ctx);
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", className)}>
      {pending ? (
        <>
          <Spinner /> Working…
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Field error message for a named input; use under custom controls that aren't Field/SelectField. */
export function ErrorText({ name }: { name: string }) {
  const { state } = use(Ctx);
  const msg = state?.fieldErrors?.[name];
  return msg ? <p className="mt-1 text-[12.5px] leading-snug text-ink-red">{msg}</p> : null;
}

function Hint({ children }: { children?: ReactNode }) {
  return children ? <p className="mt-1 text-[12.5px] leading-snug text-label-2">{children}</p> : null;
}

function Label({ htmlFor, children, required }: { htmlFor: string; children?: ReactNode; required?: boolean }) {
  if (!children) return null;
  return (
    <label htmlFor={htmlFor} className="label">
      {children}
      {required && <span className="text-ink-red"> *</span>}
    </label>
  );
}

interface BaseProps {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function Field({
  name, label, hint, required, className, disabled, type = "text", defaultValue, placeholder, step, min, max, autoFocus, lang,
}: BaseProps & { type?: string; defaultValue?: string | number | null; placeholder?: string; step?: string; min?: string | number; max?: string | number; autoFocus?: boolean; lang?: string }) {
  const { state } = use(Ctx);
  const invalid = !!state?.fieldErrors?.[name];
  return (
    <div className={className}>
      <Label htmlFor={`f-${name}`} required={required}>
        {label}
      </Label>
      <input
        id={`f-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        lang={lang}
        aria-invalid={invalid || undefined}
        className={cx("input", lang === "bn" && "font-bn")}
      />
      <Hint>{hint}</Hint>
      <ErrorText name={name} />
    </div>
  );
}

export interface SelectOption {
  value: string | number;
  label: string;
}

export function SelectField({
  name, label, hint, required, className, disabled, options, defaultValue, placeholder,
}: BaseProps & { options: SelectOption[]; defaultValue?: string | number | null; placeholder?: string }) {
  const { state } = use(Ctx);
  const invalid = !!state?.fieldErrors?.[name];
  return (
    <div className={className}>
      <Label htmlFor={`f-${name}`} required={required}>
        {label}
      </Label>
      <select
        id={`f-${name}`}
        name={name}
        defaultValue={defaultValue === null || defaultValue === undefined ? "" : String(defaultValue)}
        required={required}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="input"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <Hint>{hint}</Hint>
      <ErrorText name={name} />
    </div>
  );
}

export function TextArea({ name, label, hint, required, className, defaultValue, rows = 3, placeholder }: BaseProps & { defaultValue?: string | null; rows?: number; placeholder?: string }) {
  const { state } = use(Ctx);
  const invalid = !!state?.fieldErrors?.[name];
  return (
    <div className={className}>
      <Label htmlFor={`f-${name}`} required={required}>
        {label}
      </Label>
      <textarea
        id={`f-${name}`}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className="input"
      />
      <Hint>{hint}</Hint>
      <ErrorText name={name} />
    </div>
  );
}

/** A labelled iOS switch. */
export function CheckField({ name, label, defaultChecked, hint, className }: { name: string; label: ReactNode; defaultChecked?: boolean; hint?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="inline-flex cursor-pointer items-center gap-3 text-[14px] leading-snug text-label">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="switch" />
        {label}
      </label>
      <Hint>{hint}</Hint>
    </div>
  );
}

/** A one-button form (e.g. Lock, Delete, Approve) with an optional confirmation alert. */
export function ActionButton({
  action, label, fields, confirm, confirmLabel, variant = "secondary", size = "sm",
}: {
  action: FormAction;
  label: ReactNode;
  fields?: Record<string, string | number>;
  confirm?: string;
  /** Label for the alert's action button; defaults to the button label. */
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "success";
  size?: "sm";
}) {
  const text = typeof label === "string" ? label : "Continue";
  return (
    <ActionForm
      action={action}
      confirm={confirm}
      confirmLabel={confirmLabel ?? text}
      destructive={variant === "danger" || /^(remove|delete|reject|cancel)/i.test(text)}
      className="inline-flex flex-col items-start gap-1"
    >
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
      <Submit variant={variant} size={size}>
        {label}
      </Submit>
      <InlineError />
    </ActionForm>
  );
}

function InlineError() {
  const { state } = use(Ctx);
  if (state?.error) return <span className="max-w-xs text-[12.5px] text-ink-red">{state.error}</span>;
  if (state?.message) return <span className="max-w-xs text-[12.5px] text-ink-green">{state.message}</span>;
  return null;
}
