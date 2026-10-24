import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { VerifyPhoneForm } from "@/components/auth/verify-phone-form";
import { Skeleton } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { describeAuthError } from "@/lib/auth/errors";
import { otpMethodsFromEnv } from "@/lib/auth/otp";
import { HOME_PATH, ONBOARDING_PATH } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verify your phone" };

export default function VerifyPhonePage({ searchParams }: PageProps<"/verify-phone">) {
  return (
    <>
      <h1 className="font-display text-4xl tracking-tight">Verify your phone</h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        Add a mobile number to your account. We&apos;ll text you a code to confirm it. Your number is never shown to other members.
      </p>
      <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
        <VerifyPhoneStep searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function VerifyPhoneStep({ searchParams }: Pick<PageProps<"/verify-phone">, "searchParams">) {
  const user = await requireUser({ allowUnverified: true });
  if (user.phone) redirect(HOME_PATH);
  // Never offer SMS until a provider is configured and tested (AUTH_SMS_ENABLED).
  if (!otpMethodsFromEnv(process.env).includes("sms")) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-muted">
          Adding a phone number isn&apos;t available yet. Your verified email is enough to use Vernant.
        </p>
        <ButtonLink href={ONBOARDING_PATH} size="lg" className="w-full">
          Continue
        </ButtonLink>
      </div>
    );
  }

  // Authoritative read of the number awaiting a code (not in the JWT).
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const { error } = await searchParams;
  const pending = data.user?.new_phone;

  return (
    <VerifyPhoneForm
      pendingPhone={pending ? `+${pending.replace(/^\+/, "")}` : ""}
      initialError={typeof error === "string" ? describeAuthError({ code: error }) : undefined}
    />
  );
}
