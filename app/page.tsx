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
 * visiteurs qui n'avaient aucun contexte sur ce qu'est Kreatly.
 */

// Metadata SEO + OpenGraph pour la landing (override du layout root).
export const metadata: Metadata = {
  title: "Kreatly — Planifie tes vidéos, structure ta production",
  description:
    "Le planificateur vidéo pour créateurs francophones et arabophones. Plan éditorial, scripts IA, storyboard visuel, analytics. Bilingue FR/AR, RTL natif, bêta gratuite.",
  openGraph: {
    title: "Kreatly — Le planificateur vidéo bilingue FR/AR",
    description:
      "Plan éditorial, scripts IA, storyboard visuel, analytics. Pour créateurs francophones et arabophones.",
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["ar_TN"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kreatly — Le planificateur vidéo bilingue FR/AR",
    description:
      "Plan éditorial, scripts IA, storyboard visuel, analytics. Bêta gratuite.",
  },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Les e-mails de Supabase pointent sur le « Site URL » du projet, c'est-à-dire
  // la racine, en accrochant le code de confirmation à l'adresse. Sans ce
  // renvoi, le code arrivait ici et la landing l'ignorait : l'inscription ne
  // se terminait jamais. On le fait suivre à la route qui sait l'échanger
  // contre une session.
  const sp = await searchParams;
  const authCode =
    typeof sp.code === "string"
      ? `code=${encodeURIComponent(sp.code)}`
      : typeof sp.token_hash === "string" && typeof sp.type === "string"
        ? `token_hash=${encodeURIComponent(sp.token_hash)}&type=${encodeURIComponent(sp.type)}`
        : null;
  if (authCode) redirect(`/auth/callback?${authCode}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
