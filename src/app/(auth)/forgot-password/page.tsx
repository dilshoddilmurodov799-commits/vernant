import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-4xl tracking-tight">Reset your password</h1>
      <p className="mt-2 mb-8 text-sm text-muted">Enter the email you signed up with and we&apos;ll send you a link.</p>
      <ForgotPasswordForm />
    </>
  );
}
