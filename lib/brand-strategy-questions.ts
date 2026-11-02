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
 *  1. strategyQuestions(kind) — d'abord « entreprise ou marque
 *     personnelle », puis 7 questions propres à ce parcours : assez pour
 *     une stratégie vraiment personnalisée, chacune avec son exemple.
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
  /** Chips : un seul choix possible (le suivant remplace le précédent). */
  single?: boolean;
};

/** Entreprise ou marque personnelle : la 1re question aiguille tout le reste. */
export type StrategyKind = "business" | "personal";

export const KIND_CHOICES = {
  business: "Mon entreprise",
  personal: "Ma marque personnelle",
} as const;

export function strategyKind(answers: Record<string, string>): StrategyKind | null {
  const v = (answers.strategy_kind ?? "").trim();
  if (v === KIND_CHOICES.personal) return "personal";
  if (v === KIND_CHOICES.business) return "business";
  return null;
}

const KIND_QUESTION: StrategyQuestion = {
  id: "strategy_kind",
  label: "Cette stratégie, c'est pour…",
  help: "Une entreprise se vend par son offre ; une marque personnelle par la personne. Ce n'est pas la même stratégie — ni les mêmes profils.",
  example: "Un resto, une boutique, un cabinet → entreprise. Toi, ton expertise, ton nom → marque personnelle.",
  type: "chips",
  single: true,
  chips: [KIND_CHOICES.business, KIND_CHOICES.personal],
};

const PLATFORMS_QUESTION: StrategyQuestion = {
  id: "platforms",
  label: "Où veux-tu être visible ?",
  help: "Les réseaux sur lesquels tu publies ou veux publier. Je calerai la stratégie et l'optimisation de tes profils dessus.",
  example: "Instagram et LinkedIn.",
  type: "chips",
  chips: ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube"],
};

const BUSINESS_QUESTIONS: StrategyQuestion[] = [
  {
    id: "what_you_do",
    label: "Complète cette phrase",
    help: "Trois blancs à remplir, avec tes mots. Pas de rédaction, pas de piège.",
    example:
      "un petit resto de cuisine tunisienne à La Marsa — les familles du quartier — bien manger le midi sans se ruiner",
    type: "guided",
    guidedPrefix: "Mon activité, c'est",
    guidedParts: [
      { key: "activity", label: "Ton activité", placeholder: "un petit resto tunisien à La Marsa" },
      { key: "who", label: "Tu aides qui ?", placeholder: "les familles du quartier", before: "— j'aide" },
      { key: "what", label: "À faire quoi ?", placeholder: "bien manger le midi sans se ruiner", before: "à" },
    ],
  },
  {
    id: "content_goal",
    label: "Ton objectif n°1 avec le contenu ?",
    help: "Ce que le contenu doit t'apporter avant tout.",
    example: "Vendre, te faire connaître, fidéliser…",
    type: "chips",
    chips: ["Vendre", "Me faire connaître", "Fidéliser", "Asseoir mon expertise", "Recruter"],
  },
  {
    id: "offer",
    label: "Ton offre phare, et son prix ?",
    help: "Le produit ou service que tu veux vendre en priorité. Une fourchette de prix suffit — ça me dit à qui parler.",
    example: "Le menu du midi à 18 DT, et les plateaux pour les événements d'entreprise.",
    type: "textarea",
  },
  {
    id: "differentiator",
    label: "Pourquoi on vient chez toi plutôt qu'ailleurs ?",
    help: "Ce que tes concurrents ne font pas, ou moins bien. Même un détail compte.",
    example: "Tout est fait maison le matin même, et on connaît nos clients par leur prénom.",
    type: "textarea",
  },
  {
    id: "customer_words",
    label: "Ce que tes clients disent de toi ?",
    help: "Leurs mots à eux, tels quels — avis Google, messages, ce qu'ils répètent. C'est ce qui sonne le plus vrai dans un contenu.",
    example: "« On se croirait chez sa mère », « toujours servi vite ».",
    type: "textarea",
  },
  {
    id: "how_found",
    label: "Aujourd'hui, comment tes clients te trouvent ?",
    help: "Plusieurs choix possibles.",
    example: "Le bouche-à-oreille et Instagram.",
    type: "chips",
    chips: ["Bouche-à-oreille", "Instagram", "Facebook", "TikTok", "Google", "LinkedIn", "Passage devant chez moi"],
  },
  PLATFORMS_QUESTION,
];

const PERSONAL_QUESTIONS: StrategyQuestion[] = [
  {
    id: "who_you_are",
    label: "Complète cette phrase",
    help: "Ton métier, qui tu aides, et à quoi. Avec tes mots.",
    example:
      "consultante en marketing digital — les patrons de PME — trouver des clients sur les réseaux sans y passer leurs soirées",
    type: "guided",
    guidedPrefix: "Je suis",
    guidedParts: [
      { key: "activity", label: "Ton métier / ton expertise", placeholder: "consultante en marketing digital" },
      { key: "who", label: "Tu aides qui ?", placeholder: "les patrons de PME", before: "— j'aide" },
      { key: "what", label: "À faire quoi ?", placeholder: "trouver des clients sur les réseaux", before: "à" },
    ],
  },
  {
    id: "content_goal",
    label: "Ta marque personnelle doit t'apporter quoi ?",
    help: "Ce que tu attends en premier de ta visibilité.",
    example: "Des clients, des invitations à parler, un poste…",
    type: "chips",
    chips: [
      "Trouver des clients",
      "Être reconnu(e) comme expert(e)",
      "Décrocher des opportunités (conférences, médias, poste)",
      "Fédérer une communauté",
      "Vendre une formation",
    ],
  },
  {
    id: "journey",
    label: "Ton parcours, en 2-3 phrases ?",
    help: "D'où tu viens et ce qui t'a mené(e) là. C'est ton histoire qui fait qu'on te suit toi, et pas quelqu'un d'autre.",
    example: "10 ans en agence à Paris, retour à Tunis en 2020, j'ai lancé mon activité pour aider les PME d'ici.",
    type: "textarea",
  },
  {
    id: "convictions",
    label: "Ce que tu défends, ou ce qui t'agace dans ton métier ?",
    help: "Une conviction, un avis tranché. Une marque personnelle sans opinion ne se retient pas.",
    example: "Poster tous les jours ne sert à rien sans stratégie ; les « gourous » vendent du rêve.",
    type: "textarea",
  },
  {
    id: "three_words",
    label: "3 mots pour qu'on te décrive ?",
    help: "Ce qu'on doit ressentir en voyant ton profil.",
    example: "Directe, pédagogue, terrain.",
    type: "text",
  },
  {
    id: "show_or_not",
    label: "Ce que tu acceptes de montrer… et ce que tu gardes pour toi ?",
    help: "Ton visage, tes coulisses, ta vie perso, ta famille ? Ta stratégie respectera tes limites.",
    example: "Mon visage et mes coulisses de travail oui, ma famille non.",
    type: "textarea",
  },
  PLATFORMS_QUESTION,
];

/** Le questionnaire complet d'un parcours (la 1re question = le choix du parcours). */
export function strategyQuestions(kind: StrategyKind | null): StrategyQuestion[] {
  return [KIND_QUESTION, ...(kind === "personal" ? PERSONAL_QUESTIONS : BUSINESS_QUESTIONS)];
}

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
  // En marque personnelle, le parcours est déjà demandé : « pourquoi tu as
  // commencé » ferait doublon.
  const personal = strategyKind(answers) === "personal";
  return STRATEGY_FOLLOWUPS.filter(
    (q) => !(personal && q.id === "why_started") && !(answers[q.id] ?? "").trim(),
  );
}
