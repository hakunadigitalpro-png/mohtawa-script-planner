"use server";

import { createClient } from "@/lib/supabase/server";

export async function resetPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "emailRequired" as const };

  // URL de base de CONFIANCE (variable d'env), jamais un en-tête de requête :
  // `origin` / `x-forwarded-host` sont falsifiables → empoisonnement possible
  // du lien de réinitialisation. Si la variable n'est pas définie, on laisse
  // `redirectTo` vide et Supabase utilise sa Site URL configurée (sûre).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: siteUrl ? `${siteUrl}/login` : undefined,
  });

  if (error) return { error: error.message };
  return { success: "sent" as const };
}
