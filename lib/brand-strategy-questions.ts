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

export type StrategyQuestionType = "text" | "textarea" | "chips" | "guided";

export type GuidedPart = {
  key: string;
  label: string;
  placeholder: string;
  /** Texte affiché juste AVANT ce blanc (ex : "— j'aide", "à"). */
  before?: string;
};

export type StrategyQuestion = {
  id: string;
  label: string;
  help: string;
  example: string;
  type: StrategyQuestionType;
  chips?: string[];
  /** Début de la phrase, avant le 1er blanc. Type "guided" uniquement. */
  guidedPrefix?: string;
  guidedParts?: GuidedPart[];
  optional?: boolean;
};

export const STRATEGY_QUESTIONS: StrategyQuestion[] = [
  {
    id: "what_you_do",
    label: "Complète cette phrase",
    help: "Trois blancs à remplir, avec tes mots. Pas de rédaction, pas de piège — c'est tout ce dont j'ai besoin pour construire ta stratégie.",
    example:
      "un petit resto de cuisine tunisienne à La Marsa — les familles du quartier — bien manger le midi sans se ruiner",
    type: "guided",
    guidedPrefix: "Mon activité, c'est",
    guidedParts: [
      {
        key: "activity",
        label: "Ton activité",
        placeholder: "un petit resto tunisien à La Marsa",
      },
      {
        key: "who",
        label: "Tu aides qui ?",
        placeholder: "les familles du quartier",
        before: "— j'aide",
      },
      {
        key: "what",
        label: "À faire quoi ?",
        placeholder: "bien manger le midi sans se ruiner",
        before: "à",
      },
    ],
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
