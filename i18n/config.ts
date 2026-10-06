export const LOCALES = ["fr", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_COOKIE = "kreatly_locale";

// Ancien nom (avant le rebranding Mohtawa → Kreatly), lu en secours pour ne pas
// repasser les arabophones en français. Supprimé dès que le nouveau cookie est
// écrit. À retirer une fois l'ancien cookie expiré (1 an).
export const LEGACY_LOCALE_COOKIE = "mohtawa_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

export const RTL_LOCALES: Locale[] = ["ar"];

export function isRtl(locale: string) {
  return RTL_LOCALES.includes(locale as Locale);
}

export function dirOf(locale: string): "ltr" | "rtl" {
  return isRtl(locale) ? "rtl" : "ltr";
}
