import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Service-role client: bypasses RLS. Server-only, for narrowly scoped lookups and admin jobs;
 * never hand its results to the browser unfiltered. Returns null when SUPABASE_SERVICE_ROLE_KEY
 * isn't set, so callers must degrade gracefully.
 */
export function createAdminClient() {
  const env = getSupabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !key) return null;
  return createClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
