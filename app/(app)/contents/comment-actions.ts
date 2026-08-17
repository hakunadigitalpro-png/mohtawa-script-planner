"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommentTargetType = "plan" | "script" | "scene" | "slide";

/**
 * Crée un commentaire racine (parent_id = null) sur un item d'une vidéo.
 */
export async function createComment(params: {
  contentId: string;
  targetType: CommentTargetType;
  targetId: string;
  body: string;
}) {
  const body = params.body.trim();
  if (!body) return { error: "Le commentaire ne peut pas être vide." };
  if (body.length > 2000) return { error: "Commentaire trop long (2000 caractères max)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { data, error } = await supabase
    .from("content_comments")
    .insert({
      content_id: params.contentId,
      target_type: params.targetType,
      target_id: params.targetId,
      user_id: user.id,
      body,
      parent_id: null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/content/${params.contentId}`);
  return { ok: true as const, id: data.id };
}

/**
 * Répond à un commentaire existant (parent_id = parent racine).
 * On reprend le target_type/target_id du parent pour cohérence.
 */
export async function replyToComment(params: {
  parentId: string;
  contentId: string;
  body: string;
}) {
  const body = params.body.trim();
  if (!body) return { error: "La réponse ne peut pas être vide." };
  if (body.length > 2000) return { error: "Réponse trop longue (2000 caractères max)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  // On lit le parent pour récupérer son ancre
  const { data: parent, error: parentErr } = await supabase
    .from("content_comments")
    .select("target_type, target_id, content_id")
    .eq("id", params.parentId)
    .maybeSingle();

  if (parentErr || !parent) return { error: "Commentaire parent introuvable." };

  const { data, error } = await supabase
    .from("content_comments")
    .insert({
      content_id: parent.content_id,
      target_type: parent.target_type,
      target_id: parent.target_id,
      parent_id: params.parentId,
      user_id: user.id,
      body,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/content/${params.contentId}`);
  return { ok: true as const, id: data.id };
}

/**
 * Toggle "resolved" sur un commentaire racine.
 */
export async function toggleCommentResolved(params: {
  commentId: string;
  contentId: string;
  resolved: boolean;
}) {
  const supabase = await createClient();
  // Passe par la RPC dédiée (migration 0036) : la policy UPDATE de
  // content_comments est désormais réservée à l'auteur ; le toggle "résolu"
  // par n'importe quel membre se fait via cette fonction (qui ne touche que
  // la colonne resolved après vérif d'appartenance).
  const { error } = await supabase.rpc("set_comment_resolved", {
    p_comment_id: params.commentId,
    p_resolved: params.resolved,
  });
  if (error) return { error: error.message };

  revalidatePath(`/content/${params.contentId}`);
  return { ok: true as const };
}

/**
 * Édite le body d'un commentaire (seul l'auteur peut, via RLS).
 */
export async function updateCommentBody(params: {
  commentId: string;
  contentId: string;
  body: string;
}) {
  const body = params.body.trim();
  if (!body) return { error: "Le commentaire ne peut pas être vide." };
  if (body.length > 2000) return { error: "Commentaire trop long (2000 caractères max)." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_comments")
    .update({ body })
    .eq("id", params.commentId);
  if (error) return { error: error.message };

  revalidatePath(`/content/${params.contentId}`);
  return { ok: true as const };
}

/**
 * Supprime un commentaire (cascade les réponses).
 */
export async function deleteComment(params: {
  commentId: string;
  contentId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_comments")
    .delete()
    .eq("id", params.commentId);
  if (error) return { error: error.message };

  revalidatePath(`/content/${params.contentId}`);
  return { ok: true as const };
}

/**
 * Marque tous les commentaires d'une vidéo comme "lus" pour le user courant.
 * Appelé à l'ouverture de l'inbox ou d'un thread.
 */
export async function markContentRead(contentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_content_read", {
    p_content_id: contentId,
  });
  if (error) return { error: error.message };

  // Le "lu" ne concerne que le badge non-lu de cette vidéo (comments/
  // content_reads) — pas la cloche de notifications (système séparé,
  // migration 0013). Inutile d'invalider tout le layout à chaque ouverture
  // de l'inbox commentaires.
  revalidatePath(`/content/${contentId}`);
  return { ok: true as const };
}
