import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AiError } from "@/lib/ai";

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

  return { supabase, user };
}
