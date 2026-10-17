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

export async function createAdCampaign() {
  const supabase = await createClient();
  const { active } = await resolveActiveBrand();
  if (!active) return { error: "Aucune marque active" };

  const { data, error } = await supabase
    .from("ad_campaigns")
    .insert({
      brand_id: active.id,
      title: "Nouvelle campagne",
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Création impossible" };

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
