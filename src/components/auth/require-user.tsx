import { requireUser } from "@/lib/auth/session";

/**
 * Server-side session check for protected route trees. Must sit inside a
 * <Suspense> boundary because it reads request cookies. The proxy redirects
 * earlier as UX; this is the check that doesn't depend on it.
 */
export async function RequireUser({ children, allowUnverifiedPhone }: { children: React.ReactNode; allowUnverifiedPhone?: boolean }) {
  await requireUser({ allowUnverifiedPhone });
  return children;
}
