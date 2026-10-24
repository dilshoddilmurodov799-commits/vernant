import type { Metadata } from "next";
import { Suspense } from "react";
import { OtpAuth } from "@/components/auth/otp-auth";
import { otpMethodsFromEnv } from "@/lib/auth/otp";

export const metadata: Metadata = { title: "Join" };

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <>
      <h1 className="font-display text-4xl tracking-tight">Join Vernant</h1>
      <p className="mt-2 mb-8 text-sm text-muted">A community for adults. Takes about two minutes.</p>
      <Suspense fallback={<OtpAuth mode="register" />}>
        <RegisterFlow searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function RegisterFlow({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const { next } = await searchParams;
  // Read per request (after the dynamic searchParams), so enabling a channel needs no rebuild.
  return <OtpAuth mode="register" next={typeof next === "string" ? next : ""} methods={otpMethodsFromEnv(process.env)} />;
}
