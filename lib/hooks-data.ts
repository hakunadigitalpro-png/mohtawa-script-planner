export type HookCategory =
  | "curiosity"
  | "mistake"
  | "transformation"
  | "list"
  | "controversy"
  | "question"
  | "urgency";

export const HOOK_CATEGORIES: { value: HookCategory; label: string; emoji: string }[] = [
  { value: "curiosity",      label: "Curiosité",       emoji: "🔮" },
  { value: "mistake",        label: "Erreurs",         emoji: "⚠️" },
  { value: "transformation", label: "Transformation",  emoji: "🚀" },
  { value: "list",           label: "Listes & How-to", emoji: "📋" },
  { value: "controversy",    label: "Controverse",     emoji: "🔥" },
  { value: "question",       label: "Question",        emoji: "❓" },
  { value: "urgency",        label: "Urgence",         emoji: "⏰" },
];

export type Hook = {
  id: string;
  text: string;
  category: HookCategory;
};

export const HOOKS: Hook[] = [
  // ============================ CURIOSITÉ ============================
  { id: "c1",  category: "curiosity", text: "Personne ne te dit ça sur [ton sujet]." },
  { id: "c2",  category: "curiosity", text: "Le secret que [niche/concurrent] te cache." },
  { id: "c3",  category: "curiosity", text: "Voici ce que [audience] ignore complètement." },
  { id: "c4",  category: "curiosity", text: "Ce que j'ai découvert va te surprendre." },
  { id: "c5",  category: "curiosity", text: "Tu n'imagines pas ce qui se passe quand…" },
  { id: "c6",  category: "curiosity", text: "Ça, on me l'avait jamais dit." },
  { id: "c7",  category: "curiosity", text: "La vérité sur [sujet] que personne ne dit." },
  { id: "c8",  category: "curiosity", text: "Si je devais recommencer aujourd'hui, je ferais ça." },
  { id: "c9",  category: "curiosity", text: "Le truc le plus sous-coté en [niche]." },
  { id: "c10", category: "curiosity", text: "Voici ce que j'aurais aimé savoir il y a 5 ans." },

  // ============================ ERREURS ==============================
  { id: "e1",  category: "mistake", text: "3 erreurs que font 90 % des [audience]." },
  { id: "e2",  category: "mistake", text: "Stop. Tu fais ça mal si tu [comportement]." },
  { id: "e3",  category: "mistake", text: "Évite cette erreur que j'ai faite à mes débuts." },
  { id: "e4",  category: "mistake", text: "Pourquoi ton [sujet] ne marche pas (et comment fixer)." },
  { id: "e5",  category: "mistake", text: "Si tu fais ça, arrête tout de suite." },
  { id: "e6",  category: "mistake", text: "Tu perds du temps sur [sujet]. Voici pourquoi." },
  { id: "e7",  category: "mistake", text: "L'erreur n°1 qui te coûte cher en [domaine]." },
  { id: "e8",  category: "mistake", text: "Personne ne devrait commencer [sujet] sans savoir ça." },
  { id: "e9",  category: "mistake", text: "Tu fais ça ? Alors tu sabotes tes résultats." },
  { id: "e10", category: "mistake", text: "Le piège classique du [niche] (et comment l'éviter)." },

  // ========================= TRANSFORMATION =========================
  { id: "t1",  category: "transformation", text: "Comment je suis passé de [A] à [B] en [durée]." },
  { id: "t2",  category: "transformation", text: "Avant, je faisais X. Maintenant, je fais Y." },
  { id: "t3",  category: "transformation", text: "De 0 à [résultat] : voici la méthode." },
  { id: "t4",  category: "transformation", text: "J'ai testé [méthode] pendant 30 jours. Résultat ?" },
  { id: "t5",  category: "transformation", text: "Voici ce qui a tout changé dans mon [domaine]." },
  { id: "t6",  category: "transformation", text: "Une habitude. Un résultat. Trois mois." },
  { id: "t7",  category: "transformation", text: "Ma plus grosse leçon après [X années / projets]." },
  { id: "t8",  category: "transformation", text: "Ce que personne ne te dit après ton premier [résultat]." },
  { id: "t9",  category: "transformation", text: "L'avant/après que je n'aurais jamais cru possible." },
  { id: "t10", category: "transformation", text: "Voici le déclic qui a tout changé pour moi." },

  // ======================== LISTES / HOW-TO ========================
  { id: "l1",  category: "list", text: "5 façons de [résultat] sans [obstacle]." },
  { id: "l2",  category: "list", text: "Top 3 [outils / astuces] que j'utilise tous les jours." },
  { id: "l3",  category: "list", text: "Voici comment [résultat] en moins de [temps]." },
  { id: "l4",  category: "list", text: "3 étapes pour [objectif] (même en partant de zéro)." },
  { id: "l5",  category: "list", text: "Les 5 règles à connaître absolument en [niche]." },
  { id: "l6",  category: "list", text: "10 secondes pour comprendre [concept]." },
  { id: "l7",  category: "list", text: "Le framework que j'utilise pour [tâche]." },
  { id: "l8",  category: "list", text: "Voici ma checklist avant chaque [moment clé]." },
  { id: "l9",  category: "list", text: "Comment faire [X] comme un pro (en moins de [temps])." },
  { id: "l10", category: "list", text: "3 hacks que [pro] utilisent en secret." },

  // =========================== CONTROVERSE ===========================
  { id: "k1",  category: "controversy", text: "Tout le monde dit [X]. Et pourtant…" },
  { id: "k2",  category: "controversy", text: "Hot take : [opinion clivante]." },
  { id: "k3",  category: "controversy", text: "[Niche] est mort. Voici pourquoi." },
  { id: "k4",  category: "controversy", text: "Désolé, mais [croyance commune] est fausse." },
  { id: "k5",  category: "controversy", text: "Tu veux la vraie raison ? Ça va te déplaire." },
  { id: "k6",  category: "controversy", text: "Personne n'ose le dire, alors je vais le faire." },
  { id: "k7",  category: "controversy", text: "Arrêtez avec [tendance]. Voici pourquoi." },
  { id: "k8",  category: "controversy", text: "Ce qu'on t'a appris sur [sujet] est faux." },
  { id: "k9",  category: "controversy", text: "Je vais me faire des ennemis avec cette vidéo." },
  { id: "k10", category: "controversy", text: "Cette opinion va te faire grincer des dents." },

  // ============================= QUESTION =============================
  { id: "q1",  category: "question", text: "Tu te demandes encore comment [objectif] ?" },
  { id: "q2",  category: "question", text: "As-tu déjà ressenti [émotion] face à [situation] ?" },
  { id: "q3",  category: "question", text: "Pourquoi [résultat] reste-t-il aussi rare ?" },
  { id: "q4",  category: "question", text: "Tu fais [action] ? Cette vidéo est pour toi." },
  { id: "q5",  category: "question", text: "Et si je te disais qu'en [durée], tu peux [résultat] ?" },
  { id: "q6",  category: "question", text: "Combien de fois t'as essayé [tâche] sans réussir ?" },
  { id: "q7",  category: "question", text: "Quel est le vrai prix de ton inaction sur [sujet] ?" },
  { id: "q8",  category: "question", text: "Tu es sûr que tu [croyance] ? Voici une autre lecture." },
  { id: "q9",  category: "question", text: "Pourquoi certains explosent en [niche] et pas toi ?" },
  { id: "q10", category: "question", text: "Tu fais partie des 5 % qui [comportement] ?" },

  // ============================== URGENCE ==============================
  { id: "u1",  category: "urgency", text: "Si tu ne fais pas ça maintenant, tu vas le regretter." },
  { id: "u2",  category: "urgency", text: "Avant qu'il soit trop tard, regarde ça." },
  { id: "u3",  category: "urgency", text: "Le marché change. Voici comment t'adapter." },
  { id: "u4",  category: "urgency", text: "Plus tu attends, plus ça te coûte." },
  { id: "u5",  category: "urgency", text: "Ne fais surtout pas l'impasse sur ça en 2025." },
  { id: "u6",  category: "urgency", text: "Le timing parfait pour [action], c'est maintenant." },
  { id: "u7",  category: "urgency", text: "Si t'attends, quelqu'un d'autre va prendre ta place." },
  { id: "u8",  category: "urgency", text: "Dernière chance avant que [opportunité] disparaisse." },
  { id: "u9",  category: "urgency", text: "Dans 6 mois, ce sera trop tard pour commencer." },
  { id: "u10", category: "urgency", text: "Tout le monde fonce sur [tendance]. Toi aussi ?" },
];

export function getHooksByCategory(category: HookCategory) {
  return HOOKS.filter((h) => h.category === category);
}

export function categoryLabel(category: HookCategory) {
  return HOOK_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function categoryEmoji(category: HookCategory) {
  return HOOK_CATEGORIES.find((c) => c.value === category)?.emoji ?? "💡";
}
