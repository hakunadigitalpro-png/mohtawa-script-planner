/**
 * Zone visée sur une image, en fractions de sa taille (0 à 1) : elle reste au
 * bon endroit quelle que soit la largeur à laquelle l'image s'affiche.
 */
export type Anchor = { x: number; y: number; w: number; h: number };

const round = (n: number) => Math.round(n * 10000) / 10000;

/** Ramène une zone dans l'image. Null si elle n'est pas exploitable. */
export function normalizeAnchor(a: unknown): Anchor | null {
  if (!a || typeof a !== "object") return null;
  const { x, y, w, h } = a as Record<string, unknown>;
  if ([x, y, w, h].some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
  const left = Math.min(Math.max(x as number, 0), 1);
  const top = Math.min(Math.max(y as number, 0), 1);
  const width = Math.min(w as number, 1 - left);
  const height = Math.min(h as number, 1 - top);
  if (width <= 0 || height <= 0) return null;
  return { x: round(left), y: round(top), w: round(width), h: round(height) };
}

/** A, B, C… — le repère d'une zone sur l'image et dans le fil. */
export function zoneLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}
