"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BrandRole = "owner" | "admin" | "editor" | "viewer";

/**
 * Crée un lien d'invitation pour une marque.
 * Retourne le token brut — le frontend reconstruit l'URL avec window.location.origin
 * (comme pour les liens de partage de vidéo, plus robuste que d'embed la base URL en SSR).
 */
export async function createBrandInvitation(
  brandId: string,
  role: BrandRole = "editor",
  note: string | null = null,
) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_brand_invitation", {
    p_brand_id: brandId,
    p_role: role,
    p_note: note && note.trim() ? note.trim() : null,
  });

  if (error) return { error: error.message };

  // RPC retourne un table (id, token) → tableau d'objets
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.token) return { error: "Impossible de générer le lien." };

  revalidatePath(`/brands/${brandId}`);
  return { ok: true as const, id: row.id as string, token: row.token as string };
}

/**
 * Révoque (supprime) une invitation pending.
 */
export async function revokeBrandInvitation(
  invitationId: string,
  brandId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_invitations")
    .delete()
    .eq("id", invitationId);
  if (error) return { error: error.message };

  revalidatePath(`/brands/${brandId}`);
  return { ok: true as const };
}

/**
 * Accepte une invitation (token venant de /invite/[token]).
 */
export async function acceptBrandInvitation(token: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_brand_invitation", {
    p_token: token,
  });

  if (error) return { error: error.message };

  const brandId = (data as { brand_id?: string } | null)?.brand_id;
  if (!brandId) return { error: "Acceptation impossible." };

  revalidatePath("/", "layout");
  return { ok: true as const, brandId };
}

/**
 * Change le rôle d'un membre.
 */
export async function updateMemberRole(
  brandId: string,
  userId: string,
  role: BrandRole,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member_role", {
    p_brand_id: brandId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) return { error: error.message };

  revalidatePath(`/brands/${brandId}`);
  return { ok: true as const };
}

/**
 * Retire un membre de la marque (ou quitte si user === self).
 */
export async function removeBrandMember(
  brandId: string,
  userId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_brand_member", {
    p_brand_id: brandId,
    p_user_id: userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
