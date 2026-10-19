/**
 * Types partagés pour le module Publicités (migration 0059).
 * Isolé de `lib/types.ts` pour ne pas enfler le fichier principal.
 */

/**
 * Vocabulaire commun avec `STATUSES` / `SIMPLE_STATUSES` (lib/constants.ts) :
 * `approved`, `scheduled`, `live` sont partagés — même mot, même sens. Les
 * campagnes n'ont pas d'étapes de production (script/tournage/montage) ; une
 * campagne commence en brouillon et finit en live. `stopped` = arrêt
 * prématuré, propre aux campagnes publicitaires.
 */
export type AdCampaignStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "live"
  | "stopped";

export type AdCampaignReviewState =
  | "pending_review"
  | "approved"
  | "needs_revision"
  | null;

export type AdCampaignEvaluation = "poor" | "average" | "good" | null;

export type AdCampaign = {
  id: string;
  brand_id: string;
  user_id: string;
  title: string;
  theme: string | null;
  platforms: string[];
  objective: string | null;
  post_text: string | null;
  targeting_age: string | null;
  targeting_location: string | null;
  targeting_interests: string | null;
  budget_global: string | null;
  budget_daily: string | null;
  date_start: string | null;
  date_end: string | null;
  status: AdCampaignStatus;
  review_state: AdCampaignReviewState;
  approved_by: string | null;
  approved_at: string | null;
  reach: number | null;
  clicks: number | null;
  leads: number | null;
  emails: number | null;
  essays: number | null;
  analysis: string | null;
  evaluation: AdCampaignEvaluation;
  live_url: string | null;
  created_at: string;
  updated_at: string;
};

export type AdCampaignMediaKind = "visual" | "targeting" | "stats";

export type AdCampaignMedia = {
  id: string;
  campaign_id: string;
  kind: AdCampaignMediaKind;
  position: number;
  image_url: string;
  caption: string | null;
  created_at: string;
};

export type AdCampaignComment = {
  id: string;
  campaign_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export const AD_STATUS_LABEL: Record<AdCampaignStatus, string> = {
  draft: "Brouillon",
  approved: "Validée",
  scheduled: "Programmée",
  live: "Live",
  stopped: "Arrêtée",
};

/**
 * Un ad set — un groupe d'audience/budget sous une campagne. Reproduit la
 * structure Meta : une campagne peut en avoir 1 à N, chacun avec son
 * propre ciblage et son propre budget quotidien.
 */
export type AdSet = {
  id: string;
  campaign_id: string;
  name: string | null;
  targeting_age: string | null;
  targeting_location: string | null;
  targeting_interests: string | null;
  budget_daily: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

/** Une ad = un visuel + un hook. Un ad set en porte 1 à N (A/B). */
export type Ad = {
  id: string;
  ad_set_id: string;
  name: string | null;
  hook: string | null;
  visual_url: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export const AD_PLATFORMS = [
  "Meta",
  "Google",
  "TikTok",
  "LinkedIn",
  "Microsoft",
] as const;
