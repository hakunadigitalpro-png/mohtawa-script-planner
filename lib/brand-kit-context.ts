import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { GeneratedStrategy, StrategyAudience } from "@/lib/types";

/**
 * Voix de marque + hashtags récurrents, issus de la Stratégie de contenu.
 * Récupérés côté SERVEUR et appliqués automatiquement : l'utilisatrice ne les
 * ressaisit jamais, ils découlent de sa stratégie.
 */
export async function getBrandKitContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentId: string,
): Promise<{
  voice?: string;
  hashtags: string[];
  /** Thème choisi dans l'onglet Plan — il était rempli, il était affiché, et
   *  il n'arrivait jamais jusqu'au générateur. */
  theme?: string;
  /** Objectif du contenu, même histoire. */
  objective?: string;
  /** Cibles de la stratégie, pour que l'écran de génération les propose. */
  audiences: StrategyAudience[];
}> {
  const { data: content } = await supabase
    .from("contents")
    .select("brand_id, pillar, objective")
    .eq("id", contentId)
    .maybeSingle();
  if (!content) return { hashtags: [], audiences: [] };

  const [kitRes, strategyRes] = await Promise.all([
    supabase
      .from("brand_kits")
      .select("voice, hashtags")
      .eq("brand_id", content.brand_id)
      .maybeSingle(),
    supabase
      .from("brand_strategies")
      .select("generated")
      .eq("brand_id", content.brand_id)
      .maybeSingle(),
  ]);

  const kit = kitRes.data;
  const generated = strategyRes.data?.generated as GeneratedStrategy | null;

  return {
    voice: kit?.voice?.trim() || undefined,
    hashtags: (kit?.hashtags ?? []) as string[],
    theme: (content as { pillar: string | null }).pillar?.trim() || undefined,
    objective:
      (content as { objective: string | null }).objective?.trim() || undefined,
    audiences: generated?.audiences ?? [],
  };
}
