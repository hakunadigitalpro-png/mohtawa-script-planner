export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_COOKIE = "mohtawa_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
};

export const RTL_LOCALES: Locale[] = ["ar"];

export function isRtl(locale: string) {
  return RTL_LOCALES.includes(locale as Locale);
}

export function dirOf(locale: string): "ltr" | "rtl" {
  return isRtl(locale) ? "rtl" : "ltr";
}
