/**
 * Theme preference store. The preference persists in localStorage and is applied as
 * `data-theme` on <html>. `THEME_SCRIPT` runs before first paint (see app/layout.tsx)
 * so there is no flash of the wrong theme; use-theme.ts keeps it in sync afterwards.
 * This file has no client-only imports so the server layout can read it.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "vernant-theme";
/** Vernant is dark-first; people can opt into light or follow their OS. */
export const DEFAULT_THEME: ThemePreference = "dark";
export const THEME_COLORS: Record<ResolvedTheme, string> = { dark: "#09090a", light: "#f8f7f4" };

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** Inline, dependency-free version of `applyTheme` for the pre-paint <script>. Keep in sync. */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(p!=="light"&&p!=="dark"&&p!=="system")p=${JSON.stringify(DEFAULT_THEME)};var t=p==="system"?(matchMedia(${JSON.stringify(DARK_QUERY)}).matches?"dark":"light"):p,r=document.documentElement,c=t==="dark"?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)};r.dataset.theme=t;r.dataset.themePreference=p;r.style.colorScheme=t;var m=function(){var e=document.querySelector('meta[name="theme-color"]');if(e)e.setAttribute("content",c)};m();document.addEventListener("DOMContentLoaded",m)}catch(e){}})()`;
