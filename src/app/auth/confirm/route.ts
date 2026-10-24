import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/paths";
import { confirmParamsSchema } from "@/lib/auth/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for links in Supabase auth emails (sign-up confirmation, password
 * recovery). Accepts the token-hash form used by the recommended email templates
 * and the PKCE `code` form used by the default templates.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const params = confirmParamsSchema.safeParse(Object.fromEntries(searchParams));
  const fail = () => NextResponse.redirect(new URL("/auth/error", request.url));
  if (!params.success || !isSupabaseConfigured()) return fail();

  const supabase = await createClient();
  const { error } =
    "token_hash" in params.data
      ? await supabase.auth.verifyOtp({ token_hash: params.data.token_hash, type: params.data.type })
      : await supabase.auth.exchangeCodeForSession(params.data.code);
  if (error) return fail();

  const fallback = "type" in params.data && params.data.type === "recovery" ? "/reset-password" : "/onboarding";
  return NextResponse.redirect(new URL(safeNextPath(searchParams.get("next"), fallback), request.url));
}
