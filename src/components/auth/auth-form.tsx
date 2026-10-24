"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, MailCheck } from "lucide-react";
import { requestPasswordReset, resendConfirmation, signIn, updatePassword, type AuthFormState } from "@/lib/auth/actions";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/schemas";
import { isSupabaseConfigured, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const IDLE: AuthFormState = { status: "idle" };

/** Email or username + password. `next` is re-checked on the server as a same-origin path. */
export function AuthForm({ next = "" }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, IDLE);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <div className="space-y-4">
      <form action={action} noValidate className="space-y-4">
        <ConfigNotice />
        {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
        <input type="hidden" name="next" value={next} />
        <Field label="Email or username" error={errors.identifier}>
          {(p) => (
            <Input
              {...p}
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              defaultValue={values.identifier}
              required
            />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" />}
        </Field>
        <p className="-mt-1 text-right text-sm">
          <Link href="/forgot-password" className="rounded text-accent hover:text-accent-hover">
            Forgot password?
          </Link>
        </p>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "One moment…" : "Log in"}
        </Button>

        <p className="text-center text-sm text-muted">
          New to Vernant?{" "}
          <Link href="/register" className="rounded text-accent hover:text-accent-hover">
            Create an account
          </Link>
        </p>
      </form>
      {state.unconfirmedEmail && <ResendConfirmation key={state.unconfirmedEmail} email={state.unconfirmedEmail} />}
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, IDLE);

  if (state.status === "success") {
    return (
      <SuccessPanel icon={MailCheck} title="Check your email">
        If an account exists for <strong className="text-fg">{state.message}</strong>, we&apos;ve sent a link to reset your password. Open it in this browser.
      </SuccessPanel>
    );
  }

  return (
    <form action={action} noValidate className="space-y-4">
      <ConfigNotice />
      {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
      <Field label="Email" error={state.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" maxLength={254} defaultValue={state.values?.email} required />}
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="rounded text-accent hover:text-accent-hover">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, IDLE);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-4">
      {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
      <Field label="New password" error={errors.password} hint={`At least ${PASSWORD_MIN} characters`}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" />}
      </Field>
      <Field label="Confirm new password" error={errors.confirmPassword}>
        {(p) => <PasswordInput {...p} name="confirmPassword" autoComplete="new-password" />}
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}

function ResendConfirmation({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmation, IDLE);
  if (state.status !== "idle") {
    return (
      <p role="status" className={cn("text-center text-sm", state.status === "error" ? "text-danger" : "text-muted")}>
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="text-center">
      <input type="hidden" name="email" value={email} />
      <button type="submit" disabled={pending} className="rounded text-sm text-accent hover:text-accent-hover disabled:opacity-50">
        {pending ? "Sending…" : "Resend confirmation email"}
      </button>
    </form>
  );
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} maxLength={PASSWORD_MAX} required={props.required ?? true} className="pr-11" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-subtle hover:text-fg"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function SuccessPanel({ icon: Icon = CheckCircle2, title, children }: { icon?: typeof CheckCircle2; title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-2xl border border-line bg-surface p-5">
      <Icon className="size-5 text-accent" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function ConfigNotice() {
  if (isSupabaseConfigured()) return null;
  return <FormAlert>{SUPABASE_NOT_CONFIGURED}</FormAlert>;
}
