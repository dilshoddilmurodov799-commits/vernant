import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, SUPABASE_NOT_CONFIGURED } from "./env";

/**
 * Browser Supabase client. Uses ONLY the public URL + publishable key; every
 * query it makes is constrained by Row Level Security. Never import a
 * service-role key here.
 */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error(SUPABASE_NOT_CONFIGURED);
  return createBrowserClient(env.url, env.key);
}
