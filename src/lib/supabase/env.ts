/**
 * Public Supabase settings. Both values are safe for the browser: the publishable
 * key only grants what Row Level Security allows. The variables are referenced
 * literally so Next.js can inline them into client bundles.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured() {
  return getSupabaseEnv() !== null;
}

export const SUPABASE_NOT_CONFIGURED =
  "Supabase is not configured. Copy .env.example to .env.local and add your project URL and publishable key.";
