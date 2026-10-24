import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LOGIN_PATH } from "./paths";

export interface SessionUser {
  id: string;
  email?: string;
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
  return { id: data.claims.sub, email: data.claims.email };
});

/** Server-side gate for protected pages and actions. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}
