import { cookies } from "next/headers";

export type Theme = "light" | "dark" | "custom";

export const THEME_COOKIE = "mohtawa_theme";
export const ACCENT_COOKIE = "mohtawa_accent";
export const TINT_COOKIE = "mohtawa_tint";

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
  const themeRaw = store.get(THEME_COOKIE)?.value;
  const accentRaw = store.get(ACCENT_COOKIE)?.value;
  const tintRaw = store.get(TINT_COOKIE)?.value;
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
