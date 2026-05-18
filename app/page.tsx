import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/landing-page";

/**
 * Route racine `/` :
 * - Utilisateur connecté → redirection directe vers /dashboard (UX habituelle)
 * - Visiteur non connecté → landing page publique (acquisition)
 *
 * On a délibérément retiré le redirect vers /login : on perdait 100% des
 * visiteurs qui n'avaient aucun contexte sur ce qu'est Mohtawa.
 */

// Metadata SEO + OpenGraph pour la landing (override du layout root).
export const metadata: Metadata = {
  title: "Mohtawa — Planifie tes vidéos, structure ta production",
  description:
    "Le planificateur vidéo pour créateurs francophones et arabophones. Plan éditorial, scripts IA, storyboard visuel, analytics. Bilingue FR/AR, RTL natif, bêta gratuite.",
  openGraph: {
    title: "Mohtawa — Le planificateur vidéo bilingue FR/AR",
    description:
      "Plan éditorial, scripts IA, storyboard visuel, analytics. Pour créateurs francophones et arabophones.",
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["ar_TN"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mohtawa — Le planificateur vidéo bilingue FR/AR",
    description:
      "Plan éditorial, scripts IA, storyboard visuel, analytics. Bêta gratuite.",
  },
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
