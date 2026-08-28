/* =========================================================================
   Les notes de Krea — l'encouragement chiffré
   -------------------------------------------------------------------------
   Krea ne se contente pas d'afficher un nombre : elle dit ce qu'il VEUT DIRE
   et ce qu'il y a à faire ensuite. Un chiffre brut posé sur un écran
   n'encourage personne.

   Logique pure et testée : ce sont des seuils, et un seuil qui se trompe
   dit « tu es loin » à quelqu'un qui est en avance.
   ========================================================================= */

export type KreaNote = {
  /** Le texte affiché, déjà rédigé — pas de gabarit à trous côté composant. */
  text: string;
  /** `win` = on célèbre (accent vert), `push` = on relance, `info` = neutre. */
  tone: "win" | "push" | "info";
};

/** Paliers fêtés. Au-delà de 100, on arrête : ce n'est plus un cap, c'est une habitude. */
const MILESTONES = [10, 25, 50, 100];

export type DashboardStats = {
  /** Contenus créés depuis toujours. */
  total: number;
  /** Contenus déjà en ligne. */
  published: number;
  /** Contenus datés sur le mois en cours. */
  thisMonth: number;
  /** Objectif mensuel de la marque. */
  goal: number;
};

/**
 * UNE note pour le tableau de bord, jamais plusieurs : on choisit la plus
 * utile du moment. L'ordre des règles EST la hiérarchie des messages.
 */
export function dashboardNote(s: DashboardStats): KreaNote | null {
  // Rien du tout : inutile de parler d'objectif à quelqu'un qui n'a pas commencé.
  if (s.total === 0) {
    return {
      text: "On commence ? Dis-moi juste ton sujet, je crée le contenu et j'écris le script.",
      tone: "info",
    };
  }

  // Un cap rond, ça se fête — et ça ne se fête qu'une fois, pile dessus.
  if (MILESTONES.includes(s.total)) {
    return {
      text: `Bravo, ${s.total} contenus créés. Tu as construit quelque chose de régulier — c'est exactement ce qui fait la différence.`,
      tone: "win",
    };
  }

  // Beaucoup de préparé, rien en ligne : le blocage n'est pas la production.
  if (s.published === 0 && s.total >= 3) {
    return {
      text: `Tu as ${s.total} contenus prêts et aucun publié. Le plus dur est fait — choisis-en un et mets-le en ligne.`,
      tone: "push",
    };
  }

  if (s.thisMonth === 0) {
    return {
      text: "Rien de planifié ce mois-ci. On en cale un ensemble ?",
      tone: "push",
    };
  }

  if (s.thisMonth >= s.goal) {
    return {
      text: `${s.thisMonth} contenus ce mois : tu es dans ton objectif. Tiens ce rythme, c'est lui qui paie.`,
      tone: "win",
    };
  }

  const missing = s.goal - s.thisMonth;
  return {
    text: `${s.thisMonth} contenus ce mois, il t'en manque ${missing} pour ton objectif. On peut en préparer ${missing > 3 ? "quelques-uns" : missing === 1 ? "un" : missing.toString()} maintenant.`,
    tone: "push",
  };
}

export type AnalyticsStats = {
  /** Thème qui rassemble le plus de vues, s'il y en a un. */
  topTheme: { name: string; views: number } | null;
  /** Contenus publiés dont les résultats sont renseignés. */
  measured: number;
  /** Contenus publiés au total. */
  published: number;
};

/** Le conseil de la page Statistiques : quoi refaire, ou quoi remplir. */
export function analyticsNote(s: AnalyticsStats): KreaNote | null {
  if (s.published === 0) {
    return {
      text: "Cette page se remplira dès que tu auras publié. Rien à faire pour l'instant.",
      tone: "info",
    };
  }

  // Sans chiffres saisis, aucun conseil n'est honnête : on demande la matière.
  if (s.measured === 0) {
    return {
      text: `${s.published} contenus en ligne, mais aucun résultat saisi. Renseigne les vues d'un ou deux et je te dirai ce qui marche.`,
      tone: "push",
    };
  }

  if (s.measured < 3) {
    return {
      text: "Encore un ou deux contenus mesurés et je pourrai comparer tes thèmes entre eux.",
      tone: "info",
    };
  }

  if (s.topTheme) {
    return {
      text: `« ${s.topTheme.name} » est ton thème le plus vu. Refais-en un cette semaine, sur un angle un peu différent.`,
      tone: "win",
    };
  }

  return {
    text: "Range tes contenus par thème et je pourrai te dire lequel marche le mieux.",
    tone: "info",
  };
}
