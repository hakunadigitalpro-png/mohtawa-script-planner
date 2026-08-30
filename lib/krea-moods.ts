/* =========================================================================
   Les réactions de Krea
   -------------------------------------------------------------------------
   Krea ne dit pas la même chose selon le moment : elle félicite, elle
   relance, elle réfléchit. Son visage doit suivre — c'est ce qui sépare une
   mascotte d'un logo posé à côté du texte.

   Une humeur = une pose (un PNG) + une animation. Tant qu'une pose n'est pas
   fournie, on retombe sur le portrait par défaut et seule l'animation change :
   la fonctionnalité marche déjà, elle gagne juste en présence le jour où les
   visuels arrivent.
   ========================================================================= */

export type KreaMood =
  /** Neutre, présente. Chat au repos, bulles d'accueil. */
  | "idle"
  /** Elle félicite : cap franchi, objectif tenu, thème qui marche. */
  | "win"
  /** Elle relance : il manque des contenus, rien n'est publié. */
  | "push"
  /** Elle travaille : génération en cours, réponse en préparation. */
  | "thinking";

const DEFAULT_SRC = "/mascot/krea-avatar.png";

/**
 * Poses RÉELLEMENT présentes dans `public/mascot/`. On n'y déclare un fichier
 * qu'une fois déposé — pointer vers un PNG absent afficherait une image
 * cassée, ce qui est pire que pas de pose du tout.
 *
 * Pour activer une pose : déposer le PNG détouré (fond transparent, cadrage
 * identique au portrait actuel) puis décommenter sa ligne.
 */
const POSES: Partial<Record<KreaMood, string>> = {
  win: "/mascot/krea-win.png",
  push: "/mascot/krea-push.png",
  thinking: "/mascot/krea-thinking.png",
};

/**
 * Dimensions intrinsèques de chaque visuel. Le portrait est presque carré,
 * les poses corps entier ne le sont pas du tout : sans ça, Krea rétrécirait
 * brutalement en passant de « repos » à « félicitation », puisqu'une image
 * large calée sur une largeur fixe devient toute plate.
 *
 * On dimensionne donc par la HAUTEUR, constante d'une humeur à l'autre, et on
 * en déduit la largeur. Codé en dur plutôt que mesuré au chargement : ça évite
 * un décalage de mise en page pendant que l'image arrive.
 */
const POSE_SIZE: Record<KreaMood, { w: number; h: number }> = {
  idle: { w: 500, h: 480 },
  win: { w: 700, h: 456 },
  push: { w: 700, h: 574 },
  thinking: { w: 664, h: 700 },
};

export function moodSrc(mood: KreaMood): string {
  return POSES[mood] ?? DEFAULT_SRC;
}

/** Largeur à donner pour obtenir la hauteur demandée, ratio respecté. */
export function moodWidth(mood: KreaMood, height: number): number {
  const { w, h } = POSES[mood] ? POSE_SIZE[mood] : POSE_SIZE.idle;
  return Math.round((height * w) / h);
}

/** Classe d'animation — active même sans pose dédiée. */
export function moodClass(mood: KreaMood): string {
  switch (mood) {
    case "win":
      return "krea-float krea-float--win";
    case "thinking":
      return "krea-float krea-float--thinking";
    case "push":
      return "krea-float krea-float--push";
    default:
      return "krea-float";
  }
}
