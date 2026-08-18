import type { EquipmentPlacement, EquipmentPosition } from "@/lib/types";

/**
 * Règles de tournage NON NÉGOCIABLES, vérifiées en code plutôt que
 * seulement demandées à l'IA.
 *
 * Pourquoi ici et pas juste dans le prompt : un prompt est une consigne
 * probabiliste — le modèle peut la rater (il l'a déjà fait : fenêtre placée
 * "dans le dos", donc visage à contre-jour). Une règle de physique de la
 * lumière ne se négocie pas ; on la vérifie donc systématiquement sur la
 * réponse, et on affiche l'avertissement à l'utilisatrice au lieu de lui
 * demander de faire confiance aveuglément.
 */

/** Positions "devant la personne" — les seules qui éclairent le visage. */
export const FRONT_POSITIONS: EquipmentPosition[] = [
  "face",
  "avant_droite",
  "avant_gauche",
];

/** Positions "derrière" — contre-jour si c'est la seule source de lumière. */
export const BACK_POSITIONS: EquipmentPosition[] = [
  "arriere",
  "arriere_droite",
  "arriere_gauche",
];

/**
 * Mots-clés d'une SOURCE de lumière, FR / EN / AR — volontairement large :
 * mieux vaut vérifier un objet qui n'en est pas une (aucun effet visible)
 * que rater une fenêtre placée à contre-jour.
 */
const LIGHT_KEYWORDS = [
  // Lumière naturelle
  "fenetre",
  "window",
  "baie vitree",
  "verriere",
  "soleil",
  "sun",
  "lumiere naturelle",
  "daylight",
  "نافذة",
  "شباك",
  "شمس",
  // Sources artificielles
  "lumiere",
  "light",
  "led",
  "anneau",
  "ring",
  "softbox",
  "soft box",
  "boite a lumiere",
  "panneau",
  "panel",
  "lampe",
  "lamp",
  "neon",
  "projecteur",
  "spot",
  "torche",
  "flash",
  "eclairage",
  "ضوء",
  "إضاءة",
  "اضاءة",
  "مصباح",
  "لمبة",
];

/** Minuscules + accents retirés, pour comparer "Fenêtre" et "fenetre". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    // Retire les diacritiques combinants (U+0300–U+036F) laissés par NFD,
    // pour que "Fenêtre" et "fenetre" se comparent pareil.
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("")
    .trim();
}

/** Cet équipement est-il une source de lumière ? */
export function isLightSource(label: string): boolean {
  const n = normalize(label);
  return LIGHT_KEYWORDS.some((kw) => n.includes(kw));
}

export type LightingIssue =
  | { kind: "no_front_light"; lights: string[] }
  | { kind: "backlit_only_light"; lights: string[] };

/**
 * Vérifie qu'au moins une source de lumière est DEVANT la personne.
 *
 * Une lumière derrière n'est pas fausse en soi (contre-jour d'accentuation,
 * effet de contour volontaire) — elle ne l'est que si c'est la SEULE. D'où
 * le contrôle "au moins une devant" plutôt qu'une interdiction du placement
 * arrière, qui casserait un usage légitime.
 *
 * Renvoie null quand tout va bien, ou qu'il n'y a aucune lumière listée
 * (rien à vérifier — l'utilisatrice n'a pas renseigné de matériel lumineux).
 */
export function checkLighting(
  placements: EquipmentPlacement[],
): LightingIssue | null {
  const lights = placements.filter((p) => isLightSource(p.label));
  if (lights.length === 0) return null;

  const hasFrontLight = lights.some((l) => FRONT_POSITIONS.includes(l.position));
  if (hasFrontLight) return null;

  const labels = lights.map((l) => l.label);
  const allBehind = lights.every((l) => BACK_POSITIONS.includes(l.position));
  return {
    kind: allBehind ? "backlit_only_light" : "no_front_light",
    lights: labels,
  };
}
