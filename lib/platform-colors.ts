/**
 * Les couleurs d'accent par plateforme — pour teinter l'heure dans les
 * sélecteurs date-heure et aligner les pastilles sur l'identité visuelle de
 * la plateforme (Instagram rose/orange, Facebook/LinkedIn bleus, etc.).
 *
 * Ces valeurs sont volontairement figées : les sites eux-mêmes changent
 * occasionnellement de teinte mais la reconnaissance reste la même, et on
 * évite d'injecter du JS pour calculer un dégradé IG à la volée.
 */
const COLORS: Record<string, string> = {
  instagram: "#E1306C",
  facebook: "#1877F2",
  youtube: "#FF0000",
  tiktok: "#111111",
  linkedin: "#0A66C2",
};

export function platformAccentColor(
  platform: string | null | undefined,
): string {
  return COLORS[platform ?? ""] ?? "var(--color-accent, #FF6B35)";
}
