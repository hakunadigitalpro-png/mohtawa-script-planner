export const CONTENT_TYPES = [
  { value: "reel", label: "Reel", color: "var(--color-reel)" },
  { value: "story", label: "Story", color: "var(--color-story)" },
] as const;

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
};

export function platformsForType(type: string | null | undefined) {
  const allowed = PLATFORMS_BY_TYPE[type ?? ""] ?? [];
  return PLATFORMS.filter((p) => allowed.includes(p.value));
}

export const STATUSES = [
  { value: "idea", label: "Idée", color: "var(--color-status-idea)" },
  { value: "script", label: "Script", color: "var(--color-status-script)" },
  { value: "filming", label: "Tournage", color: "var(--color-status-filming)" },
  { value: "editing", label: "Montage", color: "var(--color-status-editing)" },
  { value: "scheduled", label: "Programmée", color: "var(--color-status-scheduled)" },
  { value: "published", label: "Publiée", color: "var(--color-status-published)" },
] as const;

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
  return STATUSES.find((s) => s.value === status)?.color ?? "#6b7280";
}
export function statusLabel(status: string | null | undefined) {
  return STATUSES.find((s) => s.value === status)?.label ?? status ?? "—";
}
export function platformLabel(platform: string | null | undefined) {
  return PLATFORMS.find((p) => p.value === platform)?.label ?? platform ?? "—";
}
