export const CONTENT_TYPES = [
  { value: "reel", label: "Reel", color: "var(--color-reel)" },
  { value: "story", label: "Story", color: "var(--color-story)" },
  { value: "vlog", label: "Vlog", color: "var(--color-vlog)" },
  { value: "post", label: "Post", color: "var(--color-post)" },
  { value: "carousel", label: "Carrousel", color: "var(--color-carousel)" },
  { value: "infographic", label: "Infographie", color: "var(--color-infographic)" },
] as const;

/**
 * Types "vidéo" (éditeur complet : script, storyboard…) vs types "simples"
 * (post/carrousel/infographie : éditeur allégé légende + visuels).
 */
export const SIMPLE_TYPES = ["post", "carousel", "infographic"] as const;
export function isSimpleType(type: string | null | undefined): boolean {
  return (SIMPLE_TYPES as readonly string[]).includes(type ?? "");
}

export type ContentType = (typeof CONTENT_TYPES)[number]["value"];

export const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
] as const;

export type Platform = (typeof PLATFORMS)[number]["value"];

const PLATFORMS_BY_TYPE: Record<string, Platform[]> = {
  reel: ["instagram", "tiktok", "youtube", "facebook", "linkedin"],
  story: ["instagram", "tiktok"],
  vlog: ["instagram", "tiktok", "youtube", "facebook"],
  post: ["instagram", "facebook", "linkedin"],
  carousel: ["instagram", "linkedin", "facebook", "tiktok"],
  infographic: ["instagram", "linkedin", "facebook"],
};

export function platformsForType(type: string | null | undefined) {
  const allowed = PLATFORMS_BY_TYPE[type ?? ""] ?? [];
  return PLATFORMS.filter((p) => allowed.includes(p.value));
}

/** Statuts des types "vidéo" (reel/story/vlog) — production pas à pas. */
export const STATUSES = [
  { value: "idea", label: "Idée", color: "var(--color-status-idea)" },
  { value: "script", label: "Script", color: "var(--color-status-script)" },
  { value: "filming", label: "Tournage", color: "var(--color-status-filming)" },
  { value: "editing", label: "Montage", color: "var(--color-status-editing)" },
  { value: "scheduled", label: "Programmée", color: "var(--color-status-scheduled)" },
  { value: "published", label: "Publiée", color: "var(--color-status-published)" },
] as const;

/**
 * Statuts des types "simples" (post/carrousel/infographie) — workflow de
 * design + validation d'équipe, différent de la production vidéo. "live"
 * remplace "published" : calculé automatiquement une fois la date+heure de
 * publication dépassée (RPC `recompute_live_statuses`, migration 0041), pas
 * besoin de le cocher à la main comme pour une vidéo.
 */
export const SIMPLE_STATUSES = [
  { value: "idea", label: "Idée", color: "var(--color-status-idea)" },
  { value: "design", label: "Design", color: "var(--color-status-design)" },
  {
    value: "pending_review",
    label: "En attente de validation",
    color: "var(--color-status-pending-review)",
  },
  {
    value: "needs_revision",
    label: "À réviser",
    color: "var(--color-status-needs-revision)",
  },
  { value: "approved", label: "Validé", color: "var(--color-status-approved)" },
  { value: "programmed", label: "Programmé", color: "var(--color-status-scheduled)" },
  { value: "live", label: "Live", color: "var(--color-status-live)" },
] as const;

/** Liste de statuts adaptée au type de contenu (vidéo vs simple). */
export function statusesForType(type: string | null | undefined) {
  return isSimpleType(type) ? SIMPLE_STATUSES : STATUSES;
}

/** Union dédupliquée des deux listes — pour un filtre global (dashboard). */
export const ALL_STATUSES = [...STATUSES, ...SIMPLE_STATUSES].filter(
  (s, i, arr) => arr.findIndex((s2) => s2.value === s.value) === i,
);

export type Status = (typeof STATUSES)[number]["value"];

export const OBJECTIVES = [
  { value: "education", label: "Éducation" },
  { value: "personal_brand", label: "Personal Brand" },
  { value: "sales", label: "Vente" },
  { value: "awareness", label: "Notoriété" },
  { value: "engagement", label: "Engagement" },
] as const;

export const SCENE_TAGS = [
  { value: "hook", label: "Accroche" },
  { value: "content", label: "Contenu" },
  { value: "transition", label: "Transition" },
  { value: "cta", label: "CTA" },
] as const;

export const STORY_SLOT_LABELS: Record<number, string> = {
  1: "Title / Introduction",
  2: "Story 2",
  3: "Story 3",
  4: "Story 4",
  5: "Call to Action",
};

export function typeColor(type: string | null | undefined) {
  return CONTENT_TYPES.find((t) => t.value === type)?.color ?? "#6b7280";
}
export function typeLabel(type: string | null | undefined) {
  return CONTENT_TYPES.find((t) => t.value === type)?.label ?? type ?? "—";
}
export function statusColor(status: string | null | undefined) {
  return ALL_STATUSES.find((s) => s.value === status)?.color ?? "#6b7280";
}
export function statusLabel(status: string | null | undefined) {
  return ALL_STATUSES.find((s) => s.value === status)?.label ?? status ?? "—";
}
export function platformLabel(platform: string | null | undefined) {
  return PLATFORMS.find((p) => p.value === platform)?.label ?? platform ?? "—";
}
