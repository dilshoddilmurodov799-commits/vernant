import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH, LOGIN_PATH, VERIFY_PHONE_PATH, isGuestOnlyPath, isPublicPath, requiresVerifiedPhone } from "@/lib/auth/paths";
import { getSupabaseEnv } from "./env";

/**
 * Runs before every matched request (see src/proxy.ts): refreshes the Supabase
 * session cookie and does an optimistic redirect for signed-out visitors.
 * This is UX, not the security boundary — server code re-checks the session and
 * RLS guards the data.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const env = getSupabaseEnv();

  // Fail closed: without Supabase there is no session, so only public pages render.
  if (!env) return isPublicPath(pathname) ? NextResponse.next() : redirectToLogin(request, pathname + search);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // No-store headers so a CDN never caches one user's refreshed session.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Keep this the first call after creating the client: it validates the JWT and refreshes it if needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  // The `phone` claim is only set once an SMS code has confirmed the number (see lib/auth/session.ts).
  const phoneVerified = Boolean(data?.claims.phone);

  if (!signedIn && !isPublicPath(pathname)) return withSession(redirectToLogin(request, pathname + search), response);
  if (signedIn && isGuestOnlyPath(pathname)) {
    return withSession(NextResponse.redirect(new URL(HOME_PATH, request.url)), response);
  }
  if (signedIn && !phoneVerified && requiresVerifiedPhone(pathname)) {
    return withSession(NextResponse.redirect(new URL(VERIFY_PHONE_PATH, request.url)), response);
  }
  return response;
}

function redirectToLogin(request: NextRequest, next: string) {
  const url = new URL(LOGIN_PATH, request.url);
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

/** Carry refreshed (or cleared) auth cookies and cache headers over to a redirect. */
function withSession(redirect: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const key of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(key);
    if (value) redirect.headers.set(key, value);
  }
  return redirect;
}
