"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyInvitation } from "@/lib/notify";
import { assertCanInviteMember } from "@/lib/plans";

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
  /** Facultatif : l'invitation part aussi à cette adresse. Non stockée. */
  email: string | null = null,
  /** Durée d'accès en jours (null = illimité). Posé sur le membership
   *  à l'acceptation. Utilisé surtout pour les clients invités, dont la
   *  mission a une fin. */
  expiresDays: number | null = null,
) {
  const supabase = await createClient();

  const address = email?.trim() || null;
  if (address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { error: "Cette adresse e-mail n'a pas l'air complète." };
  }

  // Garde plan : limite de membres / de viewers pour ce plan.
  const planErr = await assertCanInviteMember(brandId, role);
  if (planErr) return { error: planErr };

  const { data, error } = await supabase.rpc("create_brand_invitation", {
    p_brand_id: brandId,
    p_role: role,
    p_note: note && note.trim() ? note.trim() : null,
    p_expires_days: expiresDays,
  });

  if (error) return { error: error.message };

  // RPC retourne un table (id, token) → tableau d'objets
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.token) return { error: "Impossible de générer le lien." };

  // L'e-mail APRÈS la création, jamais bloquant : le lien existe, il reste
  // copiable même si le serveur de mail répond mal.
  const sent = address
    ? await notifyInvitation(supabase, {
        brandId,
        email: address,
        token: row.token as string,
        role,
        note: note && note.trim() ? note.trim() : null,
      })
    : false;

  revalidatePath(`/brands/${brandId}`);
  return {
    ok: true as const,
    id: row.id as string,
    token: row.token as string,
    sentTo: sent ? address : null,
    /** Une adresse était donnée mais l'e-mail n'est pas parti : à dire. */
    emailFailed: Boolean(address) && !sent,
  };
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
 * Change les sections auxquelles un membre a accès (owner/admin seulement).
 * `scopes = null` revient au défaut selon le rôle (viewer = contents,
 * autres = tout).
 */
export async function setMemberScopes(
  brandId: string,
  userId: string,
  scopes: string[] | null,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_scopes", {
    p_brand_id: brandId,
    p_user_id: userId,
    p_scopes: scopes,
  });
  if (error) return { error: error.message };
  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Change la date de fin d'accès d'un membre (owner/admin seulement).
 * `expiresAt = null` rend l'accès illimité à nouveau.
 */
export async function setMemberExpiry(
  brandId: string,
  userId: string,
  expiresAt: Date | null,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_expiry", {
    p_brand_id: brandId,
    p_user_id: userId,
    p_expires_at: expiresAt ? expiresAt.toISOString() : null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/", "layout");
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
