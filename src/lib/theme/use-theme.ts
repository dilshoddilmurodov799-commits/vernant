"use client";

import { useSyncExternalStore } from "react";
import { DARK_QUERY, DEFAULT_THEME, THEME_COLORS, THEME_STORAGE_KEY, isThemePreference, resolveTheme } from "./config";
import type { ResolvedTheme, ThemePreference } from "./config";

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME; // storage blocked (private mode, policies)
  }
}

function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference, matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  if (root.dataset.theme === theme && root.dataset.themePreference === preference) return;

  // Suppress color transitions so the whole UI switches in one frame.
  const freeze = document.createElement("style");
  freeze.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(freeze);

  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);

  void getComputedStyle(root).color; // force style flush before re-enabling transitions
  requestAnimationFrame(() => freeze.remove());
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not persisted, but still applied for this page view.
  }
  applyTheme(preference);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    if (readPreference() === "system") applyTheme("system");
    listener();
  };
  // Keep multiple tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    applyTheme(readPreference());
    listener();
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

const readResolved = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark") as ResolvedTheme;

/** `preference`/`resolved` are null during SSR and hydration, then the stored values. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => null);
  const resolved = useSyncExternalStore(subscribe, readResolved, () => null);
  return { preference, resolved, setPreference: setThemePreference };
}
