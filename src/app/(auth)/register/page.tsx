import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Join" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="font-display text-4xl tracking-tight">Join Vernant</h1>
      <p className="mt-2 mb-8 text-sm text-muted">A community for adults 18+. Takes about two minutes.</p>
      <AuthForm mode="register" />
    </>
  );
}
