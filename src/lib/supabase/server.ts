import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv, SUPABASE_NOT_CONFIGURED } from "./env";

/**
 * Server Supabase client bound to the signed-in user's session cookie, so RLS
 * still applies. Create one per request; never share it between requests. For
 * privileged admin work, create a separate server-only module that reads
 * SUPABASE_SERVICE_ROLE_KEY.
 */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error(SUPABASE_NOT_CONFIGURED);

  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only; src/proxy.ts refreshes sessions instead.
        }
      },
    },
  });
}
