"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

/**
 * Returns error codes. The page maps these to localized strings.
 *  - "passwordTooShort"   → mot de passe trop court
 *  - "needConfirm"        → success path : afficher message "vérifie ta boîte mail"
 *  - any other string     → message brut renvoyé par Supabase (en anglais en général,
 *                           on l'affiche tel quel)
 */
export async function register(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password || password.length < 6) {
    return { error: "passwordTooShort" as const };
  }

  // Même prudence que pour la réinitialisation : une adresse de confiance
  // issue de la variable d'environnement, jamais un en-tête de requête.
  // Sans elle, Supabase retombe sur sa Site URL, qui convient aussi.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      // Viser la route qui échange le code contre une session, plutôt que de
      // dépendre du chemin par défaut de la Site URL.
      ...(siteUrl
        ? { emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` }
        : {}),
    },
  });

  if (error) return { error: error.message };

  // Adresse DÉJÀ inscrite : Supabase ne renvoie ni erreur ni session, et
  // surtout n'envoie AUCUN e-mail — il refuse de révéler quelles adresses
  // ont un compte. Le seul signal est `identities` vide.
  //
  // Sans ce test, l'écran affichait « vérifie ta boîte mail » pour un message
  // qui ne partirait jamais : on attend une confirmation qui n'existe pas, et
  // on soupçonne l'envoi d'e-mails alors que tout fonctionne.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      error:
        "Cette adresse a déjà un compte. Connecte-toi, ou passe par « mot de passe oublié ».",
    };
  }

  // Email confirmations désactivées : on a déjà la session → on file à `next`.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  return { success: "confirmEmail" as const };
}
