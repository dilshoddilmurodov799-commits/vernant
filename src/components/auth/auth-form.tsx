"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, MailCheck } from "lucide-react";
import {
  requestPasswordReset,
  resendConfirmation,
  signIn,
  signUp,
  updatePassword,
  type AuthFormState,
} from "@/lib/auth/actions";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/schemas";
import { isSupabaseConfigured, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const IDLE: AuthFormState = { status: "idle" };

/** Latest date of birth that is 18 today, for the date picker. Validation happens on the server. */
function maxBirthDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

/** `next` is the post-login destination; the server action re-checks it is a same-origin path. */
export function AuthForm({ mode, next = "" }: { mode: "login" | "register"; next?: string }) {
  const isRegister = mode === "register";
  const [state, action, pending] = useActionState(isRegister ? signUp : signIn, IDLE);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  if (isRegister && state.status === "success") return <CheckEmail email={state.message ?? ""} />;

  return (
    <div className="space-y-4">
      <form action={action} noValidate className="space-y-4">
        <ConfigNotice />
        {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
        {!isRegister && <input type="hidden" name="next" value={next} />}
  
        {isRegister && (
          <Field label="Display name" error={errors.displayName}>
            {(p) => <Input {...p} name="displayName" autoComplete="nickname" maxLength={40} defaultValue={values.displayName} required />}
          </Field>
        )}
        <Field label="Email" error={errors.email}>
          {(p) => <Input {...p} name="email" type="email" autoComplete="email" maxLength={254} defaultValue={values.email} required />}
        </Field>
        <Field
          label="Password"
          error={errors.password}
          hint={isRegister ? `At least ${PASSWORD_MIN} characters` : undefined}
        >
          {(p) => <PasswordInput {...p} name="password" autoComplete={isRegister ? "new-password" : "current-password"} />}
        </Field>
        {!isRegister && (
          <p className="-mt-1 text-right text-sm">
            <Link href="/forgot-password" className="rounded text-accent hover:text-accent-hover">
              Forgot password?
            </Link>
          </p>
        )}
        {isRegister && (
          <>
            <Field label="Date of birth" error={errors.birthDate} hint="Vernant is strictly 18+. Your birth date is never shown publicly.">
              {(p) => (
                  <Input
                    {...p}
                    // Set on the client: "today" must not be frozen into the prerendered HTML.
                    ref={(el) => {
                      if (el) el.max = maxBirthDate();
                    }}
                    name="birthDate"
                    type="date"
                    defaultValue={values.birthDate}
                    required
                  />
                )}
            </Field>
            <div>
              <label className="flex items-start gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  name="terms"
                  defaultChecked={values.terms === "on"}
                  className="mt-0.5 size-4 accent-accent"
                  aria-invalid={!!errors.terms}
                  aria-describedby={errors.terms ? "terms-error" : undefined}
                />
                <span>I confirm I am 18 or older and agree to the Community Guidelines, Terms, and Privacy Policy.</span>
              </label>
              {errors.terms && (
                <p id="terms-error" className="mt-1.5 text-xs text-danger">
                  {errors.terms}
                </p>
              )}
            </div>
          </>
        )}
  
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "One moment…" : isRegister ? "Create account" : "Log in"}
        </Button>
  
        <p className="text-center text-sm text-muted">
          {isRegister ? "Already a member? " : "New to Vernant? "}
          <Link href={isRegister ? "/login" : "/register"} className="rounded text-accent hover:text-accent-hover">
            {isRegister ? "Log in" : "Create an account"}
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

function CheckEmail({ email }: { email: string }) {
  return (
    <div className="space-y-4">
      <SuccessPanel icon={MailCheck} title="Confirm your email">
        We sent a confirmation link to <strong className="text-fg">{email}</strong>. Open it to finish creating your account. If this address
        already has an account, log in instead.
      </SuccessPanel>
      <ResendConfirmation email={email} />
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="rounded text-accent hover:text-accent-hover">
          Back to log in
        </Link>
      </p>
    </div>
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

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} maxLength={PASSWORD_MAX} required className="pr-11" />
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

function FormAlert({ children }: { children: React.ReactNode }) {
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
