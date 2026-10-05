"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Bascule l'écriture assistée sur une marque (migration 0054).
 *
 * Aucun contrôle de rôle ici : la policy `brands_update_owner` (0001) limite
 * déjà l'écriture sur `brands` à owner/admin. C'est la règle du projet —
 * jamais de contrôle d'accès côté application quand la RLS le porte déjà.
 * Un editor verra donc l'interrupteur refuser, pas le code l'en empêcher.
 */
export async function setBrandAiEnabled(
  brandId: string,
  enabled: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("brands")
    .update({ ai_enabled: enabled }, { count: "exact" })
    .eq("id", brandId);

  if (error) {
    if (error.message.includes("ai_enabled")) {
      return {
        ok: false,
        error:
          "La migration 0054 n'a pas encore été exécutée dans Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }
  // Une mise à jour refusée par la RLS ne lève pas d'erreur : elle ne touche
  // simplement aucune ligne. Sans ce test, l'interrupteur semblerait marcher.
  if (count === 0) {
    return {
      ok: false,
      error: "Seul le propriétaire ou un admin de la marque peut changer ce réglage.",
    };
  }

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/", "layout");
  return { ok: true };
}
