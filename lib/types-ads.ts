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
  | "stopped"
  | "completed";

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
  /** 'photo' | 'text' | null (global). Migration 0066. */
  target_type: "photo" | "text" | null;
  /** id de la ligne ad_slides (diapo) ou ads (carte unique). Null = global. */
  target_id: string | null;
};

export const AD_STATUS_LABEL: Record<AdCampaignStatus, string> = {
  draft: "Brouillon",
  approved: "Validée",
  scheduled: "Programmée",
  live: "En cours",
  stopped: "Arrêtée",
  completed: "Terminée",
};

/**
 * Statuts proposés dans le menu de sélection. On y retire 'scheduled' :
 * dès qu'une campagne a une date de début, elle est « En cours » si on
 * est entre ses dates, « Terminée » après. 'scheduled' reste supporté
 * en base pour les campagnes historiques, mais ne s'offre plus en
 * choix manuel.
 */
export const AD_STATUS_PICKER: AdCampaignStatus[] = [
  "draft",
  "approved",
  "live",
  "completed",
  "stopped",
];

/**
 * Les objectifs de campagne proposés par les régies (Meta surtout). Mariam
 * voulait ne pas inventer : on reprend les six verbes officiels. Stockés
 * en TEXT dans `ad_campaigns.objective` — pas d'enum pour qu'une régie
 * qui change de vocabulaire ne nous casse pas la base.
 */
export const AD_OBJECTIVES: { value: string; label: string }[] = [
  { value: "awareness", label: "Notoriété" },
  { value: "traffic", label: "Trafic" },
  { value: "engagement", label: "Interactions" },
  { value: "leads", label: "Prospects" },
  { value: "app_promotion", label: "Promotion de l'application" },
  { value: "sales", label: "Ventes" },
];

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

/** Une ad = un visuel + un hook (ad à une seule diapo) OU N `AdSlide`
 *  (carrousel). Un ad set en porte 1 à N (A/B). */
export type Ad = {
  id: string;
  ad_set_id: string;
  name: string | null;
  hook: string | null;
  visual_url: string | null;
  /** Lien externe (Drive / YouTube / Vimeo) — prime sur visual_url
   *  pour la prévisualisation quand il est rempli (0072). */
  video_url: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

/** Une diapo d'ad carrousel (0065). Visuel + texte propres à cette
 *  diapo. Si une ad a 0 slides, elle vaut une seule carte avec les
 *  champs `visual_url` + `hook` de l'ad. */
export type AdSlide = {
  id: string;
  ad_id: string;
  visual_url: string | null;
  /** Lien externe vers la vidéo de la diapo (0072). */
  video_url: string | null;
  text: string | null;
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
