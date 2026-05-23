"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Ajoute un commentaire en tant qu'invité via le lien public.
 * Appelle la RPC SECURITY DEFINER `add_guest_comment` (migration 0012) qui
 * vérifie le token, le mode 'comment', la cible et insère sans auth user.
 */
export async function addGuestComment(params: {
  token: string;
  targetType: "plan" | "script" | "scene" | "slide";
  targetId: string;
  parentId: string | null;
  body: string;
  guestName: string;
  guestEmail?: string;
}) {
  const body = params.body.trim();
  const guestName = params.guestName.trim();
  if (!body) return { error: "Le commentaire ne peut pas être vide." };
  if (body.length > 2000) return { error: "Trop long (2000 caractères max)." };
  if (!guestName) return { error: "Ton nom est requis." };
  if (guestName.length > 80) return { error: "Nom trop long (80 caractères max)." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_guest_comment", {
    p_token: params.token,
    p_target_type: params.targetType,
    p_target_id: params.targetId,
    p_parent_id: params.parentId,
    p_body: body,
    p_guest_name: guestName,
    p_guest_email: params.guestEmail?.trim() ?? null,
  });

  if (error) {
    // Map SQL error codes to user-readable codes (i18n côté client)
    const msg = error.message;
    if (msg.includes("invalid_token")) return { error: "INVALID_TOKEN" };
    if (msg.includes("comments_not_allowed"))
      return { error: "COMMENTS_NOT_ALLOWED" };
    if (msg.includes("empty_body")) return { error: "EMPTY_BODY" };
    if (msg.includes("guest_name_required"))
      return { error: "GUEST_NAME_REQUIRED" };
    if (msg.includes("invalid_target_type"))
      return { error: "INVALID_TARGET" };
    if (msg.includes("invalid_parent")) return { error: "INVALID_PARENT" };
    return { error: msg };
  }

  revalidatePath(`/share/${params.token}`);
  return { ok: true as const, id: data as string };
}
