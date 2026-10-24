import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-4xl tracking-tight">Reset your password</h1>
      <p className="mt-2 mb-8 text-sm text-muted">Enter the email you signed up with and we&apos;ll send you a link.</p>
      <ForgotPasswordForm />
      <p className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
        No password, or rather not wait for a link?{" "}
        <Link href="/login" className="rounded text-accent hover:text-accent-hover">
          Log in with an email code
        </Link>
        .
      </p>
    </>
  );
}
