/**
 * Route access rules shared by the proxy and server code. Everything not listed
 * as public requires a session (fail closed). Kept dependency-free so it can be
 * unit-tested and run in the proxy.
 */
export const LOGIN_PATH = "/login";
export const HOME_PATH = "/feed";

const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/forgot-password"]);
const PUBLIC_PREFIXES = ["/auth/"];
/** Pages that make no sense once signed in. */
const GUEST_ONLY_PATHS = new Set(["/login", "/register", "/forgot-password"]);

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
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
