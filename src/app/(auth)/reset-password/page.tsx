import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/auth-form";
import { RequireUser } from "@/components/auth/require-user";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from a recovery email via /auth/confirm, which signs the user in first. */
export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="font-display text-4xl tracking-tight">Choose a new password</h1>
      <p className="mt-2 mb-8 text-sm text-muted">You&apos;ll stay signed in on this device after saving.</p>
      <Suspense>
        <RequireUser allowUnverifiedPhone>
          <ResetPasswordForm />
        </RequireUser>
      </Suspense>
    </>
  );
}
