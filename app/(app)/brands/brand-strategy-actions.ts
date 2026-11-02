"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guardAiAction } from "@/lib/ai-guard";
import { generateBrandStrategy, generateProfileOptimization, AiError } from "@/lib/ai";
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

    const { data: prev } = await supabase
      .from("brand_strategies")
      .select("generated")
      .eq("brand_id", brandId)
      .maybeSingle();

    const generated = await generateBrandStrategy({
      brandName: brand?.name ?? "",
      answers,
    });

    // Passée d'entreprise à marque perso (ou l'inverse) : les profils
    // optimisés parlaient de l'autre parcours, on les efface.
    const prevKind = (prev?.generated as GeneratedStrategy | null)?.kind ?? "business";
    const kindChanged = prev?.generated && prevKind !== generated.kind;

    const { error } = await supabase.from("brand_strategies").upsert({
      brand_id: brandId,
      answers,
      generated,
      ...(kindChanged ? { profiles: null } : {}),
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
 * Optimise le profil Instagram ou LinkedIn à partir de la stratégie déjà
 * générée — c'est elle qui garantit que les deux profils racontent la même
 * chose. `current` = le profil actuel collé tel quel (facultatif).
 */
export async function optimizeProfileAction(
  brandId: string,
  platform: "instagram" | "linkedin",
  current: string,
) {
  try {
    const { supabase } = await guardAiAction(`profile_${platform}`);
    const [{ data: brand }, { data: row }] = await Promise.all([
      supabase.from("brands").select("name").eq("id", brandId).maybeSingle(),
      supabase
        .from("brand_strategies")
        .select("answers, generated, profiles")
        .eq("brand_id", brandId)
        .maybeSingle(),
    ]);
    if (!row?.generated) {
      return { ok: false as const, error: "Crée d'abord ta stratégie : tes profils en découlent." };
    }

    const profile = await generateProfileOptimization({
      brandName: brand?.name ?? "",
      platform,
      strategy: row.generated as GeneratedStrategy,
      answers: (row.answers ?? {}) as Record<string, string>,
      current: current.slice(0, 3000),
    });

    const profiles = { ...((row.profiles ?? {}) as Record<string, unknown>), [platform]: profile };
    const { error } = await supabase
      .from("brand_strategies")
      .update({ profiles, updated_at: new Date().toISOString() })
      .eq("brand_id", brandId);
    if (error) return { ok: false as const, error: error.message };

    revalidatePath(`/brands/${brandId}`);
    return { ok: true as const, profile };
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
    // Hashtags récurrents : déduits de la stratégie, plus jamais saisis à la
    // main. Réutilisés ensuite dans les légendes générées.
    hashtags: (generated.hashtags ?? [])
      .map((h) => h.trim().replace(/^#/, ""))
      .filter(Boolean),
    updated_at: new Date().toISOString(),
  });
  if (kitError) return { ok: false as const, error: kitError.message };

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  revalidatePath("/content/[id]", "page");
  return { ok: true as const };
}
