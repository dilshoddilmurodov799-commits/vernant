import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";
import { signOut } from "@/lib/auth/actions";
import { afterOnboardingPath, HOME_PATH } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/session";
import { loadOnboardingDraft } from "@/lib/onboarding/state";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";

export const metadata: Metadata = { title: "Set up your profile" };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <Onboarding searchParams={searchParams} />
    </Suspense>
  );
}

async function Onboarding({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const [user, { next }] = await Promise.all([requireUser({ allowUnfinishedOnboarding: true }), searchParams]);
  const nextPath = typeof next === "string" ? next : "";
  const draft = await loadOnboardingDraft(user);

  // Already finished (e.g. logging in with a one-time code): carry on to where they were going.
  if (draft === "finished") redirect(afterOnboardingPath(nextPath, HOME_PATH));
  if (draft === "unavailable") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
        <ErrorState title="Profile setup isn't available right now" description="We couldn't load your account details. Try again in a few minutes." />
        <form action={signOut} className="text-center">
          <Button type="submit" variant="ghost">
            Log out
          </Button>
        </form>
      </div>
    );
  }
  return <OnboardingFlow draft={draft} next={nextPath} />;
}

function OnboardingSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 py-6" aria-busy>
      <Skeleton className="h-8 w-28 rounded-lg" />
      <Skeleton className="mt-6 h-6 w-40 rounded-lg" />
      <Skeleton className="h-12 w-3/4 rounded-xl" />
      <Skeleton className="h-11 rounded-xl" />
      <Skeleton className="h-11 rounded-xl" />
    </div>
  );
}
