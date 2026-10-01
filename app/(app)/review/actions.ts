"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ReviewResult = { ok: true } | { ok: false; error: string };

/**
 * La décision du client. Tout passe par la RPC `client_review_content`
 * (migration 0052) : depuis cette migration, un `viewer` n'a plus AUCUN
 * droit d'écriture direct sur `contents`. La fonction est le seul passage,
 * et elle ne touche que le statut, la traçabilité et le commentaire.
 */
export async function reviewContent(input: {
  contentId: string;
  decision: "approve" | "revise";
  comment?: string;
  /** Visuel visé par la remarque — sinon le retour porte sur l'ensemble. */
  mediaId?: string;
}): Promise<ReviewResult> {
  const comment = input.comment?.trim();

  // Un « je demande une modif' » sans explication laisse l'équipe sans rien
  // à corriger : la boucle tournerait à vide.
  if (input.decision === "revise" && !comment) {
    return { ok: false, error: "Dis-nous ce qui ne va pas, sinon on ne saura pas quoi corriger." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("client_review_content", {
    p_content_id: input.contentId,
    p_decision: input.decision,
    p_comment: comment || null,
    p_target_type: input.mediaId ? "media" : "plan",
    p_target_id: input.mediaId ?? "general",
  });

  if (error) {
    if (error.message.includes("not_pending")) {
      return {
        ok: false,
        error: "Ce contenu n'attend plus ta validation — quelqu'un est passé avant.",
      };
    }
    if (error.message.includes("Forbidden") || error.message.includes("not_found")) {
      return { ok: false, error: "Ce contenu ne t'est pas accessible." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/review");
  revalidatePath("/calendar");
  revalidatePath(`/content/${input.contentId}`);
  return { ok: true };
}

/**
 * Le pendant côté équipe : envoyer un contenu au client. Sans ça la boucle
 * n'a pas de début — rien ne mettait jamais un contenu en `pending_review`.
 */
export async function submitForReview(contentId: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_for_review", {
    p_content_id: contentId,
  });
  if (error) {
    if (error.message.includes("Forbidden")) {
      return { ok: false, error: "Tu n'as pas les droits pour envoyer ce contenu." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/review");
  revalidatePath("/calendar");
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}
