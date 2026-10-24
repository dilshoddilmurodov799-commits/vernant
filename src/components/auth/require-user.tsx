import { redirect } from "next/navigation";
import { ONBOARDING_PATH } from "@/lib/auth/paths";
import { getCurrentUser, hasVerifiedContact, onboardingStatus, requireUser } from "@/lib/auth/session";

/**
 * Server-side session check for protected route trees. Must sit inside a
 * <Suspense> boundary because it reads request cookies. The proxy redirects
 * earlier as UX; this is the check that doesn't depend on it.
 */
export async function RequireUser({
  children,
  allowUnverified,
  allowUnfinishedOnboarding,
}: {
  children: React.ReactNode;
  allowUnverified?: boolean;
  allowUnfinishedOnboarding?: boolean;
}) {
  await requireUser({ allowUnverified, allowUnfinishedOnboarding });
  return children;
}

/**
 * For guest-browsable pages: sends a signed-in account that hasn't finished onboarding back to
 * it instead of showing it the guest view. Renders nothing; must sit inside <Suspense>. If the
 * status can't be read, the page stays in guest mode (isMember() is false), so this fails closed.
 */
export async function ResumeOnboarding() {
  const user = await getCurrentUser();
  if (user && hasVerifiedContact(user) && (await onboardingStatus(user.id)) === "unfinished") redirect(ONBOARDING_PATH);
  return null;
}
