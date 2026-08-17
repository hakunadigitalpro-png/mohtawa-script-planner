import type { Metadata, Viewport } from "next";
import { DM_Sans, Cairo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { getThemeFromCookies, htmlDataTheme } from "@/lib/theme";
import { dirOf, isRtl, type Locale } from "@/i18n/config";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

// Police latine : DM Sans — sans-serif neutre et lisible (utilisée par
// Google Material Design). Look propre et pro sans rondeurs marquées.
// className appliquée directement sur le body pour éviter toute
// indirection CSS. Display:swap pour éviter le FOIT sur connexion lente.
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
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
  applicationName: "Kreatly",
  title: "Kreatly — Script Planner",
  description:
    "Organise tes scripts vidéo, planifie ton contenu et analyse tes résultats.",
  // Rend l'app "app-like" sur iOS quand ajoutée à l'écran d'accueil.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kreatly",
  },
};

// La couleur de la barre de statut (Android/Chrome + TWA) suit la charte.
export const viewport: Viewport = {
  themeColor: "#FF6B35",
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
      data-app-version="v2t"
      style={styleOverrides}
    >
      <body
        className={`${dmSans.className} ${cairo.variable} antialiased ${
          rtl ? "font-arabic" : ""
        }`}
      >
        <NextIntlClientProvider
          locale={locale as Locale}
          messages={messages}
        >
          {children}
        </NextIntlClientProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
