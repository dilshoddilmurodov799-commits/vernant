import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LOGIN_PATH, VERIFY_PHONE_PATH } from "./paths";

export interface SessionUser {
  id: string;
  email?: string;
  /** Set only after SMS verification: numbers are added via updateUser({ phone }), which
   * keeps the pending number in `new_phone` until verifyOtp succeeds. Phone sign-ups
   * (which set `phone` before confirmation) must stay disabled for this to hold. */
  phone?: string;
}

/**
 * The verified current user, or null. Uses getClaims(), which validates the JWT
 * signature — never trust getSession() on the server. Deduped per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Always request-time, even when unconfigured, so a build never bakes in a session result.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return { id: data.claims.sub, email: data.claims.email, phone: data.claims.phone || undefined };
});

/** Server-side gate for protected pages and actions. Accounts stay locked until the phone is verified. */
export async function requireUser({ allowUnverifiedPhone = false } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (!allowUnverifiedPhone && !user.phone) redirect(VERIFY_PHONE_PATH);
  return user;
}

/** True for a signed-in account with a verified phone: the only state allowed to act (like, follow, message…). */
export async function isMember() {
  const user = await getCurrentUser();
  return Boolean(user?.phone);
}
