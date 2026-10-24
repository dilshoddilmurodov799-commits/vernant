import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Privileged client: bypasses RLS. Server-only, for narrowly scoped lookups, processed media
 * uploads and admin jobs; never hand its results to the browser unfiltered. Takes a secret key
 * (SUPABASE_SECRET_KEY, "sb_secret_…") or the legacy SUPABASE_SERVICE_ROLE_KEY. Returns null
 * when neither is set, so callers must degrade gracefully.
 */
export function createAdminClient() {
  const env = getSupabaseEnv();
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !key) return null;
  return createClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
