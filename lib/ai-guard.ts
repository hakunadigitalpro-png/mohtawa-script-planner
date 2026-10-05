import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getActiveBrandId } from "@/lib/brand";
import { AiError } from "@/lib/ai";

/**
 * Les actions coupées par l'interrupteur IA d'une marque (migration 0054).
 *
 * Volontairement limité à la PRODUCTION de contenu. Le setup de marque —
 * `theme` (l'assistant qui crée les piliers) et `brand_strategy` (qui écrit
 * la voix de marque) — n'est PAS coupé : les piliers alimentent le menu du
 * Plan, le classement de l'Analytics, le contexte de Krea et le panneau de
 * progression. Les couper laisserait une étape de démarrage infaisable, et
 * afficherait un appel à l'action pointant vers un assistant disparu.
 */
const BRAND_GATED_ACTIONS = new Set([
  "reel",
  "story",
  "vlog",
  "storyboard",
  "caption",
  "autopsy",
  "reference",
  "krea",
]);

/**
 * Garde commun à TOUTES les Server Actions qui appellent l'IA (Claude/Groq).
 *
 *  1. Authentification : refuse si l'utilisateur n'est pas connecté.
 *  2. Rate-limiting : compte les appels IA par utilisateur (RPC
 *     `check_ai_rate_limit`, migration 0034) et refuse au-delà de la limite.
 *
 * Renvoie le client Supabase (déjà créé) + l'utilisateur pour éviter un 2e
 * `createClient()` dans l'action.
 *
 * Fail-open volontaire : si la RPC de rate-limit n'existe pas encore (migration
 * 0034 pas appliquée) ou tombe pour une autre raison, on N'EMPÊCHE PAS l'IA de
 * fonctionner — seul un vrai dépassement de limite (`ai_rate_limited`) bloque.
 * La vérif d'auth, elle, est toujours active.
 */
export async function guardAiAction(action: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AiError("auth_required", "Connecte-toi pour utiliser l'IA.");
  }

  const { error } = await supabase.rpc("check_ai_rate_limit", {
    p_action: action,
  });
  if (error?.message?.includes("ai_rate_limited")) {
    throw new AiError(
      "rate_limit",
      "Tu vas trop vite : limite d'utilisation de l'IA atteinte. Réessaie dans une minute.",
    );
  }

  // L'interrupteur de la marque (0054). Ici et nulle part ailleurs : ce garde
  // est traversé par les quinze appels IA de l'app, donc masquer les boutons
  // dans l'interface ne suffirait pas — deux actions (l'autopsie et l'analyse
  // de référence) n'ont même plus de bouton mais restent appelables.
  if (BRAND_GATED_ACTIONS.has(action)) {
    const brandId = await getActiveBrandId();
    if (brandId) {
      const { data: on, error: switchError } = await supabase.rpc(
        "is_brand_ai_enabled",
        { b: brandId },
      );
      // Fail-open, comme le rate-limit juste au-dessus : si la migration n'est
      // pas passée, on ne bloque pas le travail. Seul un `false` explicite
      // arrête l'action.
      if (!switchError && on === false) {
        throw new AiError(
          "ai_disabled",
          "L'IA est désactivée sur cette marque. Tu peux la réactiver depuis la page de la marque.",
        );
      }
    }
  }

  return { supabase, user };
}
