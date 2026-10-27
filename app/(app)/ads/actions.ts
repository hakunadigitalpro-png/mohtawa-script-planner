"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { pick } from "@/lib/utils";
import {
  notifyClientOfAdSubmission,
  notifyClientOfAdReply,
  notifyTeamOfAdClientDecision,
} from "@/lib/notify-ads";

/**
 * Toutes les mutations du module Publicités. Pattern calqué sur
 * `contents/actions.ts` : autosave par champ (`updateCampaignField`), création
 * minimaliste qui redirige vers la fiche, soumission/validation en RPC
 * (migration 0059), médias en table dédiée.
 *
 * Sécurité : `updateCampaignField` passe par une WHITELIST. `review_state`,
 * `approved_by`, `approved_at` sont volontairement HORS de cette liste —
 * ces colonnes sont la trace de la validation du client, elles ne peuvent
 * être écrites que par les RPC `submit_ad_campaign_for_review` et
 * `client_review_ad_campaign` (0059). Sans ça, un membre de l'équipe
 * pourrait auto-valider une campagne à la place du client.
 */

const EDITABLE_FIELDS = [
  "title",
  "theme",
  "platforms",
  "objective",
  "post_text",
  "targeting_age",
  "targeting_location",
  "targeting_interests",
  "budget_global",
  "budget_daily",
  "date_start",
  "date_end",
  "status",
  "reach",
  "clicks",
  "leads",
  "emails",
  "essays",
  "analysis",
  "evaluation",
  "live_url",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];
type Patch = Partial<Record<EditableField, string | number | string[] | null>>;

// Appelée en tant que `<form action={createAdCampaign}>`, donc sa signature
// doit être compatible avec `(formData: FormData) => Promise<void>` — pas de
// return d'erreur, on throw si ça casse (c'est de toute façon exceptionnel :
// l'insert ne demande qu'un `brand_id` et un titre).
export async function createAdCampaign() {
  const supabase = await createClient();
  const { active } = await resolveActiveBrand();
  if (!active) throw new Error("Aucune marque active");

  const { data, error } = await supabase
    .from("ad_campaigns")
    .insert({
      brand_id: active.id,
      title: "Nouvelle campagne",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Création impossible");

  revalidatePath("/ads");
  redirect(`/ads/${data.id}`);
}

export async function updateCampaignField(
  campaignId: string,
  patch: Patch,
) {
  const supabase = await createClient();
  // Whitelist : seuls les champs d'EDITABLE_FIELDS passent. Même garde que
  // `contents/actions.ts:156`. `review_state` et consorts sont hors liste.
  const clean = pick(patch, [...EDITABLE_FIELDS]);
  if (Object.keys(clean).length === 0) return { ok: true as const };

  const { error } = await supabase
    .from("ad_campaigns")
    .update(clean)
    .eq("id", campaignId);
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  return { ok: true as const };
}

export async function deleteAdCampaign(campaignId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_campaigns")
    .delete()
    .eq("id", campaignId);
  if (error) return { error: error.message };
  revalidatePath("/ads");
  return { ok: true as const };
}

export async function addCampaignMedia(
  campaignId: string,
  kind: "visual" | "targeting" | "stats",
  imageUrl: string,
  caption?: string | null,
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ad_campaign_media")
    .select("position")
    .eq("campaign_id", campaignId)
    .eq("kind", kind)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const { error } = await supabase.from("ad_campaign_media").insert({
    campaign_id: campaignId,
    kind,
    image_url: imageUrl,
    caption: caption ?? null,
    position: nextPos,
  });
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  return { ok: true as const };
}

export async function removeCampaignMedia(mediaId: string, campaignId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_campaign_media")
    .delete()
    .eq("id", mediaId);
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  return { ok: true as const };
}

export async function submitAdCampaignForReview(campaignId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_ad_campaign_for_review", {
    p_campaign_id: campaignId,
  });
  if (error) return { error: error.message };
  // Décision 24 : le client reçoit un e-mail chaque fois qu'on attend
  // quelque chose de lui. Non bloquant — s'il échoue, l'action réussit
  // quand même (comme pour les contenus).
  await notifyClientOfAdSubmission(supabase, campaignId);
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  revalidatePath("/review");
  return { ok: true as const };
}

export async function clientReviewAdCampaign(
  campaignId: string,
  decision: "approve" | "revise",
  comment?: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_review_ad_campaign", {
    p_campaign_id: campaignId,
    p_decision: decision,
    p_comment: comment ?? null,
  });
  if (error) return { error: error.message };
  // L'équipe doit savoir que le client a répondu. Pas de cloche DB sur les
  // campagnes en V1 — on passe par un e-mail à l'équipe, comme on le fait
  // pour le client. Même garde non bloquante.
  await notifyTeamOfAdClientDecision(supabase, campaignId, decision);
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  revalidatePath("/review");
  return { ok: true as const };
}

export async function addCampaignComment(campaignId: string, body: string) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Non authentifié" };
  const text = body.trim();
  if (!text) return { error: "Vide" };
  const { error } = await supabase.from("ad_campaign_comments").insert({
    campaign_id: campaignId,
    user_id: u.user.id,
    body: text.slice(0, 2000),
  });
  if (error) return { error: error.message };
  // Si l'auteur est l'équipe et qu'une validation est en cours : le client
  // reçoit la réponse par e-mail (même règle que `notifyClientOfReply` sur
  // les contenus).
  await notifyClientOfAdReply(supabase, campaignId, u.user.id, text);
  revalidatePath(`/ads/${campaignId}`);
  return { ok: true as const };
}

// =====================================================================
// Ad sets & Ads (migration 0064)
// =====================================================================

/** Crée un ad set vide sous une campagne. Hérite du ciblage/budget de la
 *  campagne pour que les premiers champs soient déjà remplis. */
export async function addAdSet(campaignId: string) {
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("ad_campaigns")
    .select("targeting_age, targeting_location, targeting_interests, budget_daily")
    .eq("id", campaignId)
    .maybeSingle();

  const { data: existing } = await supabase
    .from("ad_sets")
    .select("position")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("ad_sets")
    .insert({
      campaign_id: campaignId,
      name: `Ad set ${nextPos + 1}`,
      position: nextPos,
      targeting_age: campaign?.targeting_age ?? null,
      targeting_location: campaign?.targeting_location ?? null,
      targeting_interests: campaign?.targeting_interests ?? null,
      budget_daily: campaign?.budget_daily ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  return { ok: true as const, id: data.id as string };
}

const AD_SET_FIELDS = [
  "name",
  "targeting_age",
  "targeting_location",
  "targeting_interests",
  "budget_daily",
] as const;
type AdSetField = (typeof AD_SET_FIELDS)[number];

export async function updateAdSetField(
  adSetId: string,
  campaignId: string,
  field: AdSetField,
  value: string | null,
) {
  if (!(AD_SET_FIELDS as readonly string[]).includes(field)) {
    return { error: "Champ non autorisé" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_sets")
    .update({ [field]: value && value.trim() ? value : null })
    .eq("id", adSetId);
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  return { ok: true as const };
}

export async function deleteAdSet(adSetId: string, campaignId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ad_sets").delete().eq("id", adSetId);
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  return { ok: true as const };
}

export async function addAd(adSetId: string, campaignId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ads")
    .select("position")
    .eq("ad_set_id", adSetId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("ads")
    .insert({
      ad_set_id: adSetId,
      name: `Ad ${nextPos + 1}`,
      position: nextPos,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  return { ok: true as const, id: data.id as string };
}

const AD_FIELDS = ["name", "hook", "visual_url", "video_url"] as const;
type AdField = (typeof AD_FIELDS)[number];

export async function updateAdField(
  adId: string,
  campaignId: string,
  field: AdField,
  value: string | null,
) {
  if (!(AD_FIELDS as readonly string[]).includes(field)) {
    return { error: "Champ non autorisé" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("ads")
    .update({ [field]: value && value.trim() ? value : null })
    .eq("id", adId);
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  return { ok: true as const };
}

export async function deleteAd(adId: string, campaignId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ads").delete().eq("id", adId);
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  return { ok: true as const };
}

/** Ajoute une ad à la 1re ad set — ou crée un ad set par défaut si la
 *  campagne n'en a pas encore (hérite du ciblage/budget de la campagne). */
export async function addAdToDefaultSet(campaignId: string) {
  const supabase = await createClient();

  const { data: existingSet } = await supabase
    .from("ad_sets")
    .select("id")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  let adSetId = existingSet?.id as string | undefined;
  if (!adSetId) {
    const created = await addAdSet(campaignId);
    if ("error" in created) return { error: created.error };
    adSetId = created.id;
  }

  return addAd(adSetId, campaignId);
}

// =====================================================================
// Slides (carrousel) — chaque diapo a son propre visuel et son texte
// =====================================================================

export async function addAdSlide(adId: string, campaignId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ad_slides")
    .select("position")
    .eq("ad_id", adId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("ad_slides")
    .insert({ ad_id: adId, position: nextPos })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  return { ok: true as const, id: data.id as string };
}

const SLIDE_FIELDS = ["visual_url", "video_url", "text"] as const;
type SlideField = (typeof SLIDE_FIELDS)[number];

export async function updateAdSlideField(
  slideId: string,
  campaignId: string,
  field: SlideField,
  value: string | null,
) {
  if (!(SLIDE_FIELDS as readonly string[]).includes(field)) {
    return { error: "Champ non autorisé" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_slides")
    .update({ [field]: value && value.trim() ? value : null })
    .eq("id", slideId);
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  return { ok: true as const };
}

export async function deleteAdSlide(slideId: string, campaignId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ad_slides").delete().eq("id", slideId);
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  return { ok: true as const };
}

/** Commentaire ciblé sur une photo ou un texte d'ad (migration 0066).
 *  target: null = global, sinon { type: 'photo'|'text', id: slide/ad id }. */
export async function addAdCampaignTargetedComment(
  campaignId: string,
  body: string,
  target: { type: "photo" | "text"; id: string } | null,
) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Non authentifié" };
  const text = body.trim();
  if (!text) return { error: "Vide" };
  const { error } = await supabase.from("ad_campaign_comments").insert({
    campaign_id: campaignId,
    user_id: u.user.id,
    body: text.slice(0, 2000),
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/ads/${campaignId}`);
  revalidatePath("/ads");
  return { ok: true as const };
}
