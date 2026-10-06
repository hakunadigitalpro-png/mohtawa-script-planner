import { cookies } from "next/headers";

export type Theme = "light" | "dark" | "custom";

export const THEME_COOKIE = "kreatly_theme";
export const ACCENT_COOKIE = "kreatly_accent";
export const TINT_COOKIE = "kreatly_tint";

// Anciens noms (avant le rebranding Mohtawa → Kreatly). Lus en secours pour ne
// pas réinitialiser le thème des utilisateurs existants ; supprimés dès que le
// nouveau cookie est écrit. À retirer une fois les anciens cookies expirés (1 an).
export const LEGACY_THEME_COOKIE = "mohtawa_theme";
export const LEGACY_ACCENT_COOKIE = "mohtawa_accent";
export const LEGACY_TINT_COOKIE = "mohtawa_tint";

export const DEFAULT_ACCENT = "#ff5722";
export const DEFAULT_TINT = "#fdf6ef";

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function sanitizeHex(v: string | undefined | null, fallback: string) {
  if (v && HEX_RE.test(v)) return v;
  return fallback;
}

export function isTheme(v: string | undefined | null): v is Theme {
  return v === "light" || v === "dark" || v === "custom";
}

export async function getThemeFromCookies(): Promise<{
  theme: Theme;
  accent: string;
  tint: string;
}> {
  const store = await cookies();
  const themeRaw =
    store.get(THEME_COOKIE)?.value ?? store.get(LEGACY_THEME_COOKIE)?.value;
  const accentRaw =
    store.get(ACCENT_COOKIE)?.value ?? store.get(LEGACY_ACCENT_COOKIE)?.value;
  const tintRaw =
    store.get(TINT_COOKIE)?.value ?? store.get(LEGACY_TINT_COOKIE)?.value;
  return {
    theme: isTheme(themeRaw) ? themeRaw : "light",
    accent: sanitizeHex(accentRaw, DEFAULT_ACCENT),
    tint: sanitizeHex(tintRaw, DEFAULT_TINT),
  };
}

/**
 * Donne la valeur 'data-theme' à poser sur <html>.
 * Pour le mode custom on reste en clair (light) et on n'écrase que l'accent
 * via une CSS variable inline (--color-accent).
 */
export function htmlDataTheme(theme: Theme): "light" | "dark" {
  return theme === "dark" ? "dark" : "light";
}
