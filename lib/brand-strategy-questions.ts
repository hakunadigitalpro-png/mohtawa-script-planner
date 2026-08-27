/**
 * Contenu du Studio de marque.
 *
 * Principe : on ne demande PAS à un patron de PME de composer 5 textes
 * marketing sur lui-même — c'est le travail le plus dur qu'on puisse lui
 * donner. Il raconte son activité en UNE fois, comme à quelqu'un qu'il
 * rencontre, et l'IA en extrait le domaine, la cible, le problème résolu et
 * la différenciation.
 *
 * Deux temps :
 *  1. STRATEGY_QUESTIONS — le strict minimum pour produire une vraie
 *     stratégie : un récit libre + un clic sur l'objectif.
 *  2. STRATEGY_FOLLOWUPS — posées APRÈS, une fois la stratégie sous les yeux
 *     et sa valeur démontrée. Ce sont des FAITS que l'IA ne peut pas
 *     inventer sans mentir (preuve chiffrée, légitimité, histoire perso) :
 *     elles restent donc des questions, mais facultatives et jamais
 *     bloquantes.
 */

export type StrategyQuestionType = "text" | "textarea" | "chips" | "guided2";

export type GuidedPart = { key: string; label: string; placeholder: string };

export type StrategyQuestion = {
  id: string;
  label: string;
  help: string;
  example: string;
  type: StrategyQuestionType;
  chips?: string[];
  /** Mot qui précède les 2 blancs (ex : "J'aide"), type "guided2" uniquement. */
  guidedPrefix?: string;
  /** Mot qui relie les 2 blancs (ex : "à"), type "guided2" uniquement. */
  guidedJoiner?: string;
  guidedParts?: GuidedPart[];
  optional?: boolean;
};

export const STRATEGY_QUESTIONS: StrategyQuestion[] = [
  {
    id: "story",
    label: "Raconte-moi ton activité",
    help: "Comme tu l'expliquerais à quelqu'un que tu rencontres : ce que tu fais, pour qui, et ce que tu leur apportes. Pas besoin de bien formuler — j'extrais le reste tout seul.",
    example:
      "Je tiens un petit resto à La Marsa. Je fais de la cuisine tunisienne maison, avec des produits du marché. Mes clients, c'est surtout des familles du quartier et des employés qui viennent déjeuner. Le problème c'est que la salle est vide en semaine alors que le week-end c'est plein.",
    type: "textarea",
  },
  {
    id: "content_goal",
    label: "Ton objectif n°1 avec le contenu ?",
    help: "Ce que le contenu doit t'apporter avant tout.",
    example: "Vendre, te faire connaître, fidéliser, asseoir ton expertise…",
    type: "chips",
    chips: ["Vendre", "Me faire connaître", "Fidéliser", "Asseoir mon expertise"],
  },
];

/**
 * Relances proposées sur l'écran de résultats — toutes facultatives. Chacune
 * apporte une information que l'IA ne peut PAS deviner honnêtement.
 */
export const STRATEGY_FOLLOWUPS: StrategyQuestion[] = [
  {
    id: "proof_result",
    label: "Un résultat concret dont tu es fier ?",
    help: "Un chiffre ou un témoignage rend ta stratégie beaucoup plus convaincante — et c'est la seule chose que je ne peux pas deviner à ta place.",
    example: "+40% de réservations en 2 mois.",
    type: "textarea",
    optional: true,
  },
  {
    id: "legitimacy",
    label: "Pourquoi on peut te faire confiance ?",
    help: "Ton expérience, ta formation, tes résultats. Pas besoin de diplômes — l'expérience terrain compte tout autant.",
    example: "8 ans dans le métier, 50 comptes gérés.",
    type: "textarea",
    optional: true,
  },
  {
    id: "why_started",
    label: "Pourquoi tu as commencé ?",
    help: "Ton histoire, c'est ce qui te rend unique — on achète à des humains, pas à des logos. 2-3 phrases suffisent.",
    example: "J'ai galéré à me faire connaître, puis j'ai trouvé une méthode.",
    type: "textarea",
    optional: true,
  },
];

/** Les relances encore sans réponse — calculé en code, aucun appel IA. */
export function pendingFollowups(
  answers: Record<string, string>,
): StrategyQuestion[] {
  return STRATEGY_FOLLOWUPS.filter((q) => !(answers[q.id] ?? "").trim());
}
