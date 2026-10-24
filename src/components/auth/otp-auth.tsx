"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Mail, MessageCircle, Smartphone } from "lucide-react";
import { requestSignInCode, verifySignInCode, type AuthFormState } from "@/lib/auth/actions";
import { maskContact } from "@/lib/auth/contact";
import type { OtpMethod } from "@/lib/auth/form-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/primitives";
import { FormAlert } from "@/components/auth/auth-form";
import { ConsentCheckbox } from "@/components/auth/consent-checkbox";
import { PhoneField } from "@/components/auth/phone-field";
import { StepIndicator } from "@/components/auth/step-indicator";

const IDLE: AuthFormState = { status: "idle" };
/** Supabase lets an address or number request a new code once every 60 seconds by default. */
const RESEND_SECONDS = 60;
/** Submits as soon as this many digits are in (Supabase's default code length). */
const CODE_LENGTH = 6;

const METHOD_LABELS: Record<OtpMethod, string> = { email: "Email", sms: "Text message", whatsapp: "WhatsApp" };

/**
 * Contact → one-time code: steps 1–2 of sign-up, and the code option on the log-in page.
 * It's one flow either way (a new address gets an account, a known one logs in), so nothing
 * here reveals whether someone is registered. Email is always offered; SMS and WhatsApp only
 * when the server says they're configured. The contact lives in component state only; codes
 * never touch browser storage or the URL.
 */
export function OtpAuth({ mode, next = "", methods = ["email"] }: { mode: "register" | "login"; next?: string; methods?: OtpMethod[] }) {
  const [method, setMethod] = useState<OtpMethod>(methods[0] ?? "email");
  // Remount per method so each starts from a clean form.
  return <OtpFlow key={method} mode={mode} next={next} method={method} methods={methods} onMethodChange={setMethod} />;
}

function OtpFlow({
  mode,
  next,
  method,
  methods,
  onMethodChange,
}: {
  mode: "register" | "login";
  next: string;
  method: OtpMethod;
  methods: OtpMethod[];
  onMethodChange: (method: OtpMethod) => void;
}) {
  const [sendState, send, sending] = useActionState(requestSignInCode, IDLE);
  const [resendState, resend, resending] = useActionState(requestSignInCode, IDLE);
  const [verifyState, verify, verifying] = useActionState(verifySignInCode, IDLE);
  // The send result the user was looking at when they chose "Change email/number".
  const [changeFrom, setChangeFrom] = useState<AuthFormState | null>(null);
  const register = mode === "register";
  const byEmail = method === "email";
  const stepLabel = byEmail ? "Email" : "Phone";

  const sentTo = sendState.status === "success" ? sendState.contact : undefined;
  if (!sentTo || changeFrom === sendState) {
    const values = sendState.values ?? {};
    const Icon = byEmail ? Mail : method === "whatsapp" ? MessageCircle : Smartphone;
    return (
      <form action={send} noValidate className="space-y-5">
        {register && <StepIndicator step={1} label={stepLabel} />}
        {methods.length > 1 && (
          <Segmented
            label="Where to send your code"
            value={method}
            onChange={onMethodChange}
            options={methods.map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
          />
        )}
        <input type="hidden" name="method" value={method} />
        {sendState.status === "error" && sendState.message && <FormAlert>{sendState.message}</FormAlert>}
        {byEmail ? (
          <Field label="Email" error={sendState.fieldErrors?.email} hint="Never shown to other members.">
            {(p) => (
              <Input {...p} name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} defaultValue={values.email} required />
            )}
          </Field>
        ) : (
          <PhoneField
            key={values.phoneCountry}
            error={sendState.fieldErrors?.phone}
            hint="Never shown to other members."
            defaultCountry={values.phoneCountry}
            defaultNumber={values.phone}
          />
        )}
        <div className="flex gap-3 rounded-xl border border-line bg-surface p-3.5 text-sm leading-relaxed text-muted">
          <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>
            We&apos;ll send a one-time code {byEmail ? "to this address" : method === "whatsapp" ? "to this number on WhatsApp" : "to this number by text message"}.{" "}
            {register
              ? "If it already has a Vernant account, the code logs you in to it."
              : "If it's new to Vernant, we'll set up an account after you verify it."}
          </p>
        </div>
        {!byEmail && (
          <ConsentCheckbox name="consent" error={sendState.fieldErrors?.consent} defaultChecked={values.consent === "on"}>
            Send my verification code {method === "whatsapp" ? "by WhatsApp" : "by text message"}. Vernant won&apos;t use this number for
            anything else.
          </ConsentCheckbox>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={sending}>
          {sending ? "Sending code…" : "Continue"}
        </Button>
        <p className="text-center text-sm text-muted">
          {register ? "Already a member? " : "New to Vernant? "}
          <Link href={register ? "/login" : "/register"} className="rounded text-accent hover:text-accent-hover">
            {register ? "Log in" : "Create an account"}
          </Link>
        </p>
      </form>
    );
  }

  const resent = resendState.status === "success" ? (resendState.sentAt ?? 0) : 0;
  const lastSentAt = Math.max(sendState.sentAt ?? 0, resent);
  const contactField = byEmail ? "email" : "phone";

  return (
    <div className="space-y-5">
      {register && <StepIndicator step={2} />}
      <p className="text-sm leading-relaxed text-muted">
        We sent a code to <strong className="font-medium text-fg tabular-nums">{maskContact(method, sentTo)}</strong>
        {byEmail ? ". Check your inbox, and your spam folder if it's not there." : method === "whatsapp" ? " on WhatsApp." : " by text message."}
      </p>
      <form action={verify} noValidate className="space-y-4">
        <input type="hidden" name="method" value={method} />
        <input type="hidden" name={contactField} value={sentTo} />
        <input type="hidden" name="next" value={next} />
        {verifyState.status === "error" && verifyState.message && <FormAlert>{verifyState.message}</FormAlert>}
        <Field label="Verification code" error={verifyState.fieldErrors?.code ?? verifyState.fieldErrors?.[contactField]} hint="You can paste it here.">
          {(p) => (
            <Input
              {...p}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              placeholder="123456"
              className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
              required
              autoFocus
              onChange={(e) => {
                // Accept pasted codes with spaces or dashes ("123 456").
                const input = e.currentTarget;
                const digits = input.value.replace(/\D/g, "").slice(0, 10);
                if (digits !== input.value) input.value = digits;
                if (digits.length === CODE_LENGTH && !verifying) input.form?.requestSubmit();
              }}
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={verifying}>
          {verifying ? "Checking…" : "Verify and continue"}
        </Button>
      </form>
      <div className="flex items-center justify-between gap-4 text-sm">
        <ResendCode key={lastSentAt} method={method} field={contactField} contact={sentTo} action={resend} pending={resending} />
        <button type="button" onClick={() => setChangeFrom(sendState)} className="rounded text-muted hover:text-fg">
          {byEmail ? "Change email" : "Change number"}
        </button>
      </div>
      {resendState.status === "error" && resendState.message && (
        <p role="alert" className="text-sm text-danger">
          {resendState.message}
        </p>
      )}
      {resent > 0 && resent === lastSentAt && (
        <p role="status" className="text-sm text-muted">
          New code sent. Use the most recent one.
        </p>
      )}
    </div>
  );
}

/** Counts down from the last send, then offers a resend (Supabase still enforces its own limit). */
function ResendCode({
  method,
  field,
  contact,
  action,
  pending,
}: {
  method: OtpMethod;
  field: "email" | "phone";
  contact: string;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const [left, setLeft] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  if (left > 0) {
    return (
      <p className="text-subtle">
        Resend code in <span className="tabular-nums">{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</span>
      </p>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name={field} value={contact} />
      {field === "phone" && <input type="hidden" name="consent" value="on" />}
      <button type="submit" disabled={pending} className="rounded text-accent hover:text-accent-hover disabled:opacity-50">
        {pending ? "Sending…" : "Resend code"}
      </button>
    </form>
  );
}
