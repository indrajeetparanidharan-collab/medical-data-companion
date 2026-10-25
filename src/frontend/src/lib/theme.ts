/**
 * Dark-mode preference with persistence across visits.
 *
 * The preference is stored in localStorage (a UI preference, not health data)
 * and applied by toggling the `dark` class on <html>, matching the
 * `darkMode: ["class"]` Tailwind configuration.
 */

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "vitals-ledger-theme";

/** Read the stored preference, falling back to the OS setting. */
export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Apply a theme to the document and remember it. */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies.
  }
}

/** Flip the current theme and persist the result. */
export function toggleTheme(): ThemeMode {
  const next: ThemeMode = document.documentElement.classList.contains("dark")
    ? "light"
    : "dark";
  applyTheme(next);
  return next;
}

/** Apply the remembered theme as early as possible. */
export function initTheme(): ThemeMode {
  const mode = getStoredTheme();
  applyTheme(mode);
  return mode;
}
