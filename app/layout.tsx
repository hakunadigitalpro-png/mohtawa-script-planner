import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getThemeFromCookies, htmlDataTheme } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
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
  const { theme, accent, tint } = await getThemeFromCookies();
  const dataTheme = htmlDataTheme(theme);

  // Override CSS vars when the user is in custom mode.
  const styleOverrides: React.CSSProperties = {};
  if (theme === "custom") {
    (styleOverrides as Record<string, string>)["--color-accent"] = accent;
    (styleOverrides as Record<string, string>)["--color-reel"] = accent;
    (styleOverrides as Record<string, string>)["--color-ring"] = accent;
    (styleOverrides as Record<string, string>)["--color-background"] = tint;
  }

  return (
    <html lang="fr" data-theme={dataTheme} style={styleOverrides}>
      <body className={`${jakarta.variable} antialiased`}>{children}</body>
    </html>
  );
}
