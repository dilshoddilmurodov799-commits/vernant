/**
 * Route access rules shared by the proxy and server code. Everything not listed
 * as public requires a session (fail closed). Kept dependency-free so it can be
 * unit-tested and run in the proxy.
 */
export const LOGIN_PATH = "/login";
export const HOME_PATH = "/feed";
export const VERIFY_PHONE_PATH = "/verify-phone";

const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/forgot-password"]);
const PUBLIC_PREFIXES = ["/auth/"];
/** Browsable without an account: members' posts, profiles and stories. Acting on them needs one. */
const BROWSE_PATHS = new Set(["/feed", "/discover"]);
const BROWSE_PREFIXES = ["/profile/", "/stories/"];
/** Your own profile, which sits under a browse prefix. */
const MEMBER_ONLY_PATHS = new Set(["/profile/me"]);
/** Signed-in pages that work before the phone number is verified. */
const PHONE_EXEMPT_PATHS = new Set([VERIFY_PHONE_PATH, "/reset-password"]);
/** Pages that make no sense once signed in. */
const GUEST_ONLY_PATHS = new Set(["/login", "/register", "/forgot-password"]);

function isAuthFlowPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isBrowsePath(pathname: string) {
  if (MEMBER_ONLY_PATHS.has(pathname)) return false;
  return BROWSE_PATHS.has(pathname) || BROWSE_PREFIXES.some((p) => pathname.startsWith(p) && pathname.length > p.length);
}

/** Reachable without a session. */
export function isPublicPath(pathname: string) {
  return isAuthFlowPath(pathname) || isBrowsePath(pathname);
}

export function isGuestOnlyPath(pathname: string) {
  return GUEST_ONLY_PATHS.has(pathname);
}

/** Pages a signed-in account can't use until its phone number is verified (browse pages included). */
export function requiresVerifiedPhone(pathname: string) {
  return !isAuthFlowPath(pathname) && !PHONE_EXEMPT_PATHS.has(pathname);
}

/**
 * Returns `value` only if it is a same-origin path ("/feed?x=1"); otherwise the
 * fallback. Blocks open redirects such as "//evil.test", "/\evil.test" or
 * "https://evil.test".
 */
export function safeNextPath(value: string | null | undefined, fallback = HOME_PATH) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const base = "http://localhost";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
