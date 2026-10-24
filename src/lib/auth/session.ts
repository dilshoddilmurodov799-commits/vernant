import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LOGIN_PATH, ONBOARDING_PATH } from "./paths";

/**
 * `email` / `phone` come from the JWT, which Supabase only issues for an address or number it
 * has confirmed: a verified one-time code (email, SMS or WhatsApp), or a confirmation link for
 * older email + password accounts. Pending changes stay out of the claims until confirmed.
 * This holds only while "Confirm email" and phone confirmations stay on in Supabase (README);
 * the database re-checks auth.users itself before creating a profile.
 */
export interface SessionUser {
  id: string;
  email?: string;
  phone?: string;
}

/** The account has a confirmed email address or phone number. */
export function hasVerifiedContact(user: SessionUser) {
  return Boolean(user.email || user.phone);
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
  return { id: data.claims.sub, email: data.claims.email || undefined, phone: data.claims.phone || undefined };
});

/**
 * Whether the account finished onboarding (profiles.onboarded_at, which only the
 * complete_onboarding() RPC sets). "unknown" means the read failed, e.g. migrations aren't
 * applied; callers treat it as not finished.
 */
export const onboardingStatus = cache(async (userId: string): Promise<"finished" | "unfinished" | "unknown"> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("onboarded_at").eq("id", userId).maybeSingle();
  if (error) return "unknown";
  return data?.onboarded_at ? "finished" : "unfinished";
});

/**
 * Server-side gate for protected pages and actions: a session with a verified email or phone,
 * then finished onboarding (fail closed: an unknown status counts as unfinished).
 */
export async function requireUser({ allowUnverified = false, allowUnfinishedOnboarding = false } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (allowUnverified) return user;
  if (!hasVerifiedContact(user)) redirect(LOGIN_PATH);
  if (!allowUnfinishedOnboarding && (await onboardingStatus(user.id)) !== "finished") redirect(ONBOARDING_PATH);
  return user;
}

/** True only for a verified, fully onboarded account: the only state allowed to act (like, follow, message…). */
export async function isMember() {
  const user = await getCurrentUser();
  if (!user || !hasVerifiedContact(user)) return false;
  return (await onboardingStatus(user.id)) === "finished";
}
