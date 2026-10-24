"use client";

import { useActionState, useState } from "react";
import { resendPhoneCode, sendPhoneCode, signOut, verifyPhoneCode, type AuthFormState } from "@/lib/auth/actions";
import { splitInternational } from "@/lib/auth/countries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormAlert as Alert } from "@/components/auth/auth-form";
import { PhoneField } from "@/components/auth/phone-field";
import { Field, Input } from "@/components/ui/field";

const IDLE: AuthFormState = { status: "idle" };

/** Two steps: enter a number (texts a code) → enter the code. Either step can be revisited. */
export function VerifyPhoneForm({ pendingPhone, initialError }: { pendingPhone: string; initialError?: string }) {
  const [sendState, sendAction, sending] = useActionState(sendPhoneCode, IDLE);
  const [verifyState, verifyAction, verifying] = useActionState(verifyPhoneCode, IDLE);
  const [resendState, resendAction, resending] = useActionState(resendPhoneCode, IDLE);
  // The send state the user was looking at when they chose "Change number".
  const [changeFrom, setChangeFrom] = useState<AuthFormState | null>(null);

  const sentTo = sendState.status === "success" ? sendState.message : pendingPhone;
  const showPhoneStep = !sentTo || sendState.status === "error" || changeFrom === sendState;
  const error = sendState.message && sendState.status === "error" ? sendState.message : sendState.status === "idle" ? initialError : undefined;
  // Pre-fill with what was last typed, else split the number already on file.
  const prefill = sendState.values ?? splitPhone(sentTo ?? "");

  return (
    <div className="space-y-6">
      {showPhoneStep ? (
        <form action={sendAction} noValidate className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <PhoneField
            key={prefill.phoneCountry}
            error={sendState.fieldErrors?.phone}
            defaultCountry={prefill.phoneCountry}
            defaultNumber={prefill.phone}
          />
          <Button type="submit" size="lg" className="w-full" disabled={sending}>
            {sending ? "Sending code…" : "Text me a code"}
          </Button>
        </form>
      ) : (
        <>
          <form action={verifyAction} noValidate className="space-y-4">
            {verifyState.status === "error" && verifyState.message && <Alert>{verifyState.message}</Alert>}
            <p className="text-sm text-muted">
              Enter the code we sent to <strong className="font-medium text-fg">{sentTo}</strong>.
            </p>
            <Field label="Verification code" error={verifyState.fieldErrors?.code}>
              {(p) => (
                <Input
                  {...p}
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="123456"
                  className="text-center font-mono text-lg tracking-[0.4em]"
                  required
                  autoFocus
                />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={verifying}>
              {verifying ? "Checking…" : "Verify and continue"}
            </Button>
          </form>
          <div className="flex items-center justify-between gap-4 text-sm">
            <form action={resendAction}>
              <button type="submit" disabled={resending} className="rounded text-accent hover:text-accent-hover disabled:opacity-50">
                {resending ? "Sending…" : "Resend code"}
              </button>
            </form>
            <button type="button" onClick={() => setChangeFrom(sendState)} className="rounded text-muted hover:text-fg">
              Change number
            </button>
          </div>
          {resendState.status !== "idle" && (
            <p role="status" className={cn("text-sm", resendState.status === "error" ? "text-danger" : "text-muted")}>
              {resendState.message}
            </p>
          )}
        </>
      )}

      <form action={signOut} className="border-t border-line pt-4 text-center text-sm text-muted">
        Wrong account?{" "}
        <button type="submit" className="rounded text-accent hover:text-accent-hover">
          Log out
        </button>
      </form>
    </div>
  );
}

function splitPhone(value: string) {
  const split = splitInternational(value);
  return split ? { phoneCountry: split.country, phone: split.number } : { phone: value };
}
