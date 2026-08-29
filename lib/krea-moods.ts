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
  // win: "/mascot/krea-win.png",
  // push: "/mascot/krea-push.png",
  // thinking: "/mascot/krea-thinking.png",
};

export function moodSrc(mood: KreaMood): string {
  return POSES[mood] ?? DEFAULT_SRC;
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
