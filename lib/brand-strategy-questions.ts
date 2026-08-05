/**
 * Contenu du questionnaire du Studio de marque : 5 sections, 1 question à la
 * fois. Chaque question porte une explication ("help") ET un exemple concret
 * ("example") — le public cible (patron de PME, pas marketeur) ne doit
 * JAMAIS se retrouver bloqué face à un champ vide sans savoir quoi mettre.
 * Contenu validé avec l'utilisatrice avant implémentation (puis affiné après
 * un premier essai réel).
 */

export type StrategyQuestionType = "text" | "textarea" | "chips" | "guided2";

export type GuidedPart = { key: string; label: string; placeholder: string };

export type StrategyQuestion = {
  id: string;
  section: string;
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

export const STRATEGY_SECTIONS = [
  { key: "essentials", title: "L'essentiel", emoji: "✨" },
  { key: "audience", title: "Ton audience", emoji: "🎯" },
  { key: "story", title: "Ton histoire", emoji: "📖" },
  { key: "difference", title: "Ta différence", emoji: "💎" },
  { key: "proof", title: "Preuves & objectif", emoji: "🏆" },
] as const;

export const STRATEGY_QUESTIONS: StrategyQuestion[] = [
  {
    id: "brand_name_context",
    section: "essentials",
    label: "Comment s'appelle ta marque ?",
    help: "Le nom sous lequel tes clients te connaissent — déjà pré-rempli, corrige-le si besoin.",
    example: "Chez Leila · Ahmed Coaching",
    type: "text",
  },
  {
    id: "domain",
    section: "essentials",
    label: "Ton domaine ?",
    help: "Pour adapter les conseils à ton marché.",
    example: "Restauration, Coaching, Beauté, E-commerce…",
    type: "text",
  },
  {
    id: "what_you_do",
    section: "essentials",
    label: "Tu aides qui, et à faire quoi ?",
    help: "Complète juste les deux blancs, comme tu le dirais à un ami — pas besoin de bien formuler.",
    example: "Les petits restos → remplir leur salle grâce à Instagram.",
    type: "guided2",
    guidedPrefix: "J'aide",
    guidedJoiner: "à",
    guidedParts: [
      { key: "who", label: "Tu aides qui ?", placeholder: "les petits restos" },
      {
        key: "what",
        label: "À faire quoi ?",
        placeholder: "remplir leur salle grâce à Instagram",
      },
    ],
  },
  {
    id: "ideal_client",
    section: "audience",
    label: "Qui est ton client idéal ?",
    help: "La personne type : qui elle est, ce qu'elle veut. Déjà pré-rempli si tu l'as renseigné dans ton Identité de marque.",
    example: "Cheffes de PME, 30-45 ans, débordées.",
    type: "textarea",
  },
  {
    id: "problem_solved",
    section: "audience",
    label: "Quel problème tu lui résous ?",
    help: "La galère principale que tu lui enlèves.",
    example: "Pas le temps ni les idées pour poster.",
    type: "textarea",
  },
  {
    id: "where_online",
    section: "audience",
    label: "Où passe-t-elle son temps en ligne ?",
    help: "Pour savoir où publier en priorité.",
    example: "Instagram, TikTok, LinkedIn…",
    type: "chips",
    chips: ["Instagram", "TikTok", "LinkedIn", "Facebook", "YouTube"],
  },
  {
    id: "why_started",
    section: "story",
    label: "Pourquoi tu as commencé ?",
    help: "C'est pour ton storytelling : ton histoire perso, c'est ce qui va te rendre unique et créer une vraie connexion — on achète à des humains, pas à des logos. 2-3 phrases suffisent, pas besoin d'un roman.",
    example: "J'ai galéré à me faire connaître, puis j'ai trouvé une méthode.",
    type: "textarea",
  },
  {
    id: "legitimacy",
    section: "story",
    label: "Pourquoi on peut te faire confiance ?",
    help: "Ton expérience, ta formation, tes résultats — ce qui prouve que tu sais de quoi tu parles. Pas besoin de diplômes, l'expérience terrain compte tout autant.",
    example: "8 ans dans le métier, 50 comptes gérés.",
    type: "textarea",
  },
  {
    id: "why_you",
    section: "difference",
    label: "Pourquoi te choisir toi ?",
    help: "Ce qui te distingue des concurrents.",
    example: "Je ne fais QUE la restauration.",
    type: "textarea",
  },
  {
    id: "signature_method",
    section: "difference",
    label: "Ta méthode ou ton angle signature ?",
    help: "Si tu en as un, donne-lui un nom. Sinon, passe cette question.",
    example: "Méthode « Assiette qui vend ».",
    type: "text",
    optional: true,
  },
  {
    id: "proof_result",
    section: "proof",
    label: "Un résultat ou témoignage dont tu es fier ?",
    help: "Une preuve concrète que ça marche.",
    example: "+40% de réservations en 2 mois.",
    type: "textarea",
  },
  {
    id: "content_goal",
    section: "proof",
    label: "Ton objectif n°1 avec le contenu ?",
    help: "Ce que le contenu doit t'apporter avant tout.",
    example: "Vendre, te faire connaître, fidéliser, asseoir ton expertise…",
    type: "chips",
    chips: ["Vendre", "Me faire connaître", "Fidéliser", "Asseoir mon expertise"],
  },
];
