"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guardAiAction } from "@/lib/ai-guard";
import { generateBrandStrategy, AiError } from "@/lib/ai";
import type { GeneratedStrategy } from "@/lib/types";

/**
 * Sauvegarde le brouillon du questionnaire (autosave, pas d'IA) — permet à
 * la personne de reprendre le Studio de marque plus tard sans tout reperdre.
 */
export async function saveStrategyAnswers(
  brandId: string,
  answers: Record<string, string>,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("brand_strategies").upsert({
    brand_id: brandId,
    answers,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  return { ok: true as const };
}

/**
 * Génère la stratégie via Claude à partir des réponses du questionnaire, la
 * persiste, ET la propage immédiatement au Brand Kit.
 *
 * L'application est AUTOMATIQUE (plus de bouton « Appliquer ») : la stratégie
 * est la source de vérité de la marque, donc audience/voix/tagline en
 * découlent par définition. Ces champs ne sont plus saisis à la main nulle
 * part — il n'y a donc rien à écraser, et un clic de moins.
 */
export async function generateBrandStrategyAction(
  brandId: string,
  answers: Record<string, string>,
) {
  try {
    const { supabase } = await guardAiAction("brand_strategy");
    const { data: brand } = await supabase
      .from("brands")
      .select("name")
      .eq("id", brandId)
      .maybeSingle();

    const generated = await generateBrandStrategy({
      brandName: brand?.name ?? "",
      answers,
    });

    const { error } = await supabase.from("brand_strategies").upsert({
      brand_id: brandId,
      answers,
      generated,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false as const, error: error.message };

    const applied = await applyBrandStrategy(brandId, generated);
    if (!applied.ok) return { ok: false as const, error: applied.error };

    return { ok: true as const, generated };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

/**
 * Propage la stratégie au Brand Kit : tagline/audience/voix. Ne touche PAS
 * aux thèmes de contenu — ça reste le rôle de l'assistant de thèmes existant.
 *
 * Appelée automatiquement par generateBrandStrategyAction ; ces trois champs
 * n'ayant plus de saisie manuelle, l'écrasement est sans risque.
 */
export async function applyBrandStrategy(
  brandId: string,
  generated: GeneratedStrategy,
) {
  const supabase = await createClient();

  const { error: kitError } = await supabase.from("brand_kits").upsert({
    brand_id: brandId,
    tagline: generated.tagline?.trim() || null,
    audience: generated.audience_summary?.trim() || null,
    voice: generated.voice_summary?.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (kitError) return { ok: false as const, error: kitError.message };

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  revalidatePath("/content/[id]", "page");
  return { ok: true as const };
}
