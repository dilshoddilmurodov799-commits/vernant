/**
 * Route access rules shared by the proxy and server code. Everything not listed
 * as public requires a session (fail closed). Kept dependency-free so it can be
 * unit-tested and run in the proxy.
 */
export const LOGIN_PATH = "/login";
export const HOME_PATH = "/feed";
export const VERIFY_PHONE_PATH = "/verify-phone";
export const ONBOARDING_PATH = "/onboarding";
/** Where a newly finished account lands when there's no `next`. */
export const AFTER_ONBOARDING_PATH = "/discover";

const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/forgot-password"]);
const PUBLIC_PREFIXES = ["/auth/"];
/** Browsable without an account: members' posts, profiles and stories. Acting on them needs one. */
const BROWSE_PATHS = new Set(["/feed", "/discover"]);
const BROWSE_PREFIXES = ["/profile/", "/stories/"];
/** Your own profile, which sits under a browse prefix. */
const MEMBER_ONLY_PATHS = new Set(["/profile/me"]);
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

/** Onboarding, carrying a validated destination for afterwards. */
export function onboardingPath(next?: string | null) {
  const target = safeNextPath(next, "");
  return target ? `${ONBOARDING_PATH}?next=${encodeURIComponent(target)}` : ONBOARDING_PATH;
}

/** Destination once onboarding is done: `next` if safe, never onboarding itself (that would loop). */
export function afterOnboardingPath(next: string | null | undefined, fallback = AFTER_ONBOARDING_PATH) {
  const target = safeNextPath(next, fallback);
  return new URL(target, "http://localhost").pathname === ONBOARDING_PATH ? fallback : target;
}
