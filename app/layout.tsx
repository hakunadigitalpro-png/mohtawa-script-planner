import type { Metadata } from "next";
import { Manrope, Cairo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { getThemeFromCookies, htmlDataTheme } from "@/lib/theme";
import { dirOf, isRtl, type Locale } from "@/i18n/config";
import "./globals.css";

// Police latine : Manrope — sans-serif géométrique. On applique sa
// className directement sur le body (au lieu de passer par une variable
// CSS) pour éliminer tout risque de cascade cassée. Display:swap pour
// éviter le FOIT (texte invisible pendant le chargement de la police).
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// Cairo : Google Font conçue pour l'arabe + supporte aussi le latin.
// On la charge en CSS variable et on la bascule via la classe `.font-arabic`
// quand la locale est RTL.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Mohtawa Script Planner",
  description:
    "Organise tes scripts vidéo, planifie ton contenu et analyse tes résultats.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [{ theme, accent, tint }, locale, messages] = await Promise.all([
    getThemeFromCookies(),
    getLocale(),
    getMessages(),
  ]);
  const dataTheme = htmlDataTheme(theme);
  const dir = dirOf(locale);
  const rtl = isRtl(locale);

  // Override CSS vars when the user is in custom mode.
  const styleOverrides: React.CSSProperties = {};
  if (theme === "custom") {
    (styleOverrides as Record<string, string>)["--color-accent"] = accent;
    (styleOverrides as Record<string, string>)["--color-reel"] = accent;
    (styleOverrides as Record<string, string>)["--color-ring"] = accent;
    (styleOverrides as Record<string, string>)["--color-background"] = tint;
  }

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={dataTheme}
      style={styleOverrides}
    >
      <body
        className={`${manrope.className} ${cairo.variable} antialiased ${
          rtl ? "font-arabic" : ""
        }`}
      >
        <NextIntlClientProvider
          locale={locale as Locale}
          messages={messages}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
