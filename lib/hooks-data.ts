import type { Locale } from "@/i18n/config";

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

/**
 * Each hook stores both languages. The component reads the active locale
 * and picks the right variant. Placeholders ([niche], [sujet], etc.) are
 * translated too — e.g. [niche] in French → [التخصص] in Arabic.
 */
export type Hook = {
  id: string;
  text: Record<Locale, string>;
  category: HookCategory;
};

export const HOOKS: Hook[] = [
  // ============================ CURIOSITÉ ============================
  { id: "c1",  category: "curiosity", text: {
    fr: "Personne ne te dit ça sur [ton sujet].",
    ar: "لا أحد يخبرك بهذا عن [موضوعك].",
  } },
  { id: "c2",  category: "curiosity", text: {
    fr: "Le secret que [niche/concurrent] te cache.",
    ar: "السر الذي يخفيه [التخصص/المنافس] عنك.",
  } },
  { id: "c3",  category: "curiosity", text: {
    fr: "Voici ce que [audience] ignore complètement.",
    ar: "إليك ما يجهله [الجمهور] تماماً.",
  } },
  { id: "c4",  category: "curiosity", text: {
    fr: "Ce que j'ai découvert va te surprendre.",
    ar: "ما اكتشفته سيفاجئك.",
  } },
  { id: "c5",  category: "curiosity", text: {
    fr: "Tu n'imagines pas ce qui se passe quand…",
    ar: "لا يمكنك تخيل ما يحدث عندما…",
  } },
  { id: "c6",  category: "curiosity", text: {
    fr: "Ça, on me l'avait jamais dit.",
    ar: "هذا، لم يخبرني به أحد من قبل.",
  } },
  { id: "c7",  category: "curiosity", text: {
    fr: "La vérité sur [sujet] que personne ne dit.",
    ar: "الحقيقة حول [الموضوع] التي لا يقولها أحد.",
  } },
  { id: "c8",  category: "curiosity", text: {
    fr: "Si je devais recommencer aujourd'hui, je ferais ça.",
    ar: "لو كان عليّ البدء من جديد اليوم، لفعلت هذا.",
  } },
  { id: "c9",  category: "curiosity", text: {
    fr: "Le truc le plus sous-coté en [niche].",
    ar: "الشيء الأكثر تقليلاً من قيمته في [التخصص].",
  } },
  { id: "c10", category: "curiosity", text: {
    fr: "Voici ce que j'aurais aimé savoir il y a 5 ans.",
    ar: "إليك ما كنت أتمنى لو عرفته قبل 5 سنوات.",
  } },

  // ============================ ERREURS ==============================
  { id: "e1",  category: "mistake", text: {
    fr: "3 erreurs que font 90 % des [audience].",
    ar: "3 أخطاء يرتكبها 90٪ من [الجمهور].",
  } },
  { id: "e2",  category: "mistake", text: {
    fr: "Stop. Tu fais ça mal si tu [comportement].",
    ar: "توقف. أنت تفعل ذلك بشكل خاطئ إذا كنت [السلوك].",
  } },
  { id: "e3",  category: "mistake", text: {
    fr: "Évite cette erreur que j'ai faite à mes débuts.",
    ar: "تجنب هذا الخطأ الذي ارتكبته في بداياتي.",
  } },
  { id: "e4",  category: "mistake", text: {
    fr: "Pourquoi ton [sujet] ne marche pas (et comment fixer).",
    ar: "لماذا لا ينجح [الموضوع] الخاص بك (وكيف تصلحه).",
  } },
  { id: "e5",  category: "mistake", text: {
    fr: "Si tu fais ça, arrête tout de suite.",
    ar: "إذا كنت تفعل هذا، توقف فوراً.",
  } },
  { id: "e6",  category: "mistake", text: {
    fr: "Tu perds du temps sur [sujet]. Voici pourquoi.",
    ar: "أنت تضيع وقتك على [الموضوع]. إليك السبب.",
  } },
  { id: "e7",  category: "mistake", text: {
    fr: "L'erreur n°1 qui te coûte cher en [domaine].",
    ar: "الخطأ رقم 1 الذي يكلفك الكثير في [المجال].",
  } },
  { id: "e8",  category: "mistake", text: {
    fr: "Personne ne devrait commencer [sujet] sans savoir ça.",
    ar: "لا أحد يجب أن يبدأ [الموضوع] دون معرفة هذا.",
  } },
  { id: "e9",  category: "mistake", text: {
    fr: "Tu fais ça ? Alors tu sabotes tes résultats.",
    ar: "هل تفعل هذا؟ إذن أنت تخرّب نتائجك.",
  } },
  { id: "e10", category: "mistake", text: {
    fr: "Le piège classique du [niche] (et comment l'éviter).",
    ar: "الفخ الكلاسيكي لـ [التخصص] (وكيف تتجنبه).",
  } },

  // ========================= TRANSFORMATION =========================
  { id: "t1",  category: "transformation", text: {
    fr: "Comment je suis passé de [A] à [B] en [durée].",
    ar: "كيف انتقلت من [أ] إلى [ب] في [المدة].",
  } },
  { id: "t2",  category: "transformation", text: {
    fr: "Avant, je faisais X. Maintenant, je fais Y.",
    ar: "من قبل كنت أفعل س. الآن أفعل ص.",
  } },
  { id: "t3",  category: "transformation", text: {
    fr: "De 0 à [résultat] : voici la méthode.",
    ar: "من 0 إلى [النتيجة]: إليك الطريقة.",
  } },
  { id: "t4",  category: "transformation", text: {
    fr: "J'ai testé [méthode] pendant 30 jours. Résultat ?",
    ar: "جرّبت [الطريقة] لمدة 30 يوماً. النتيجة؟",
  } },
  { id: "t5",  category: "transformation", text: {
    fr: "Voici ce qui a tout changé dans mon [domaine].",
    ar: "إليك ما غيّر كل شيء في [مجالي].",
  } },
  { id: "t6",  category: "transformation", text: {
    fr: "Une habitude. Un résultat. Trois mois.",
    ar: "عادة واحدة. نتيجة واحدة. ثلاثة أشهر.",
  } },
  { id: "t7",  category: "transformation", text: {
    fr: "Ma plus grosse leçon après [X années / projets].",
    ar: "أكبر درس تعلمته بعد [س سنوات / مشاريع].",
  } },
  { id: "t8",  category: "transformation", text: {
    fr: "Ce que personne ne te dit après ton premier [résultat].",
    ar: "ما لا يخبرك به أحد بعد [النتيجة] الأولى.",
  } },
  { id: "t9",  category: "transformation", text: {
    fr: "L'avant/après que je n'aurais jamais cru possible.",
    ar: "القبل/بعد الذي لم أكن أعتقد أنه ممكن أبداً.",
  } },
  { id: "t10", category: "transformation", text: {
    fr: "Voici le déclic qui a tout changé pour moi.",
    ar: "إليك الشرارة التي غيّرت كل شيء بالنسبة لي.",
  } },

  // ======================== LISTES / HOW-TO ========================
  { id: "l1",  category: "list", text: {
    fr: "5 façons de [résultat] sans [obstacle].",
    ar: "5 طرق لـ [النتيجة] دون [العائق].",
  } },
  { id: "l2",  category: "list", text: {
    fr: "Top 3 [outils / astuces] que j'utilise tous les jours.",
    ar: "أفضل 3 [أدوات / نصائح] أستخدمها كل يوم.",
  } },
  { id: "l3",  category: "list", text: {
    fr: "Voici comment [résultat] en moins de [temps].",
    ar: "إليك كيف [النتيجة] في أقل من [الوقت].",
  } },
  { id: "l4",  category: "list", text: {
    fr: "3 étapes pour [objectif] (même en partant de zéro).",
    ar: "3 خطوات لـ [الهدف] (حتى لو بدأت من الصفر).",
  } },
  { id: "l5",  category: "list", text: {
    fr: "Les 5 règles à connaître absolument en [niche].",
    ar: "القواعد الـ 5 التي يجب معرفتها مطلقاً في [التخصص].",
  } },
  { id: "l6",  category: "list", text: {
    fr: "10 secondes pour comprendre [concept].",
    ar: "10 ثوانٍ لفهم [المفهوم].",
  } },
  { id: "l7",  category: "list", text: {
    fr: "Le framework que j'utilise pour [tâche].",
    ar: "الإطار الذي أستخدمه لـ [المهمة].",
  } },
  { id: "l8",  category: "list", text: {
    fr: "Voici ma checklist avant chaque [moment clé].",
    ar: "إليك قائمتي المرجعية قبل كل [لحظة مفتاحية].",
  } },
  { id: "l9",  category: "list", text: {
    fr: "Comment faire [X] comme un pro (en moins de [temps]).",
    ar: "كيف تفعل [س] كالمحترفين (في أقل من [الوقت]).",
  } },
  { id: "l10", category: "list", text: {
    fr: "3 hacks que [pro] utilisent en secret.",
    ar: "3 حيل يستخدمها [المحترفون] في الخفاء.",
  } },

  // =========================== CONTROVERSE ===========================
  { id: "k1",  category: "controversy", text: {
    fr: "Tout le monde dit [X]. Et pourtant…",
    ar: "الجميع يقول [س]. ومع ذلك…",
  } },
  { id: "k2",  category: "controversy", text: {
    fr: "Hot take : [opinion clivante].",
    ar: "رأي صادم: [رأي مثير للجدل].",
  } },
  { id: "k3",  category: "controversy", text: {
    fr: "[Niche] est mort. Voici pourquoi.",
    ar: "[التخصص] قد مات. إليك السبب.",
  } },
  { id: "k4",  category: "controversy", text: {
    fr: "Désolé, mais [croyance commune] est fausse.",
    ar: "آسف، ولكن [الاعتقاد الشائع] خاطئ.",
  } },
  { id: "k5",  category: "controversy", text: {
    fr: "Tu veux la vraie raison ? Ça va te déplaire.",
    ar: "هل تريد السبب الحقيقي؟ لن يعجبك.",
  } },
  { id: "k6",  category: "controversy", text: {
    fr: "Personne n'ose le dire, alors je vais le faire.",
    ar: "لا أحد يجرؤ على قولها، إذن سأقولها أنا.",
  } },
  { id: "k7",  category: "controversy", text: {
    fr: "Arrêtez avec [tendance]. Voici pourquoi.",
    ar: "توقفوا عن [الموضة]. إليكم السبب.",
  } },
  { id: "k8",  category: "controversy", text: {
    fr: "Ce qu'on t'a appris sur [sujet] est faux.",
    ar: "ما تم تعليمك إياه عن [الموضوع] خاطئ.",
  } },
  { id: "k9",  category: "controversy", text: {
    fr: "Je vais me faire des ennemis avec cette vidéo.",
    ar: "سأكسب أعداءً بهذا الفيديو.",
  } },
  { id: "k10", category: "controversy", text: {
    fr: "Cette opinion va te faire grincer des dents.",
    ar: "هذا الرأي سيجعلك تصرّ على أسنانك.",
  } },

  // ============================= QUESTION =============================
  { id: "q1",  category: "question", text: {
    fr: "Tu te demandes encore comment [objectif] ?",
    ar: "هل ما زلت تتساءل كيف [الهدف]؟",
  } },
  { id: "q2",  category: "question", text: {
    fr: "As-tu déjà ressenti [émotion] face à [situation] ?",
    ar: "هل شعرت يوماً بـ [الشعور] أمام [الموقف]؟",
  } },
  { id: "q3",  category: "question", text: {
    fr: "Pourquoi [résultat] reste-t-il aussi rare ?",
    ar: "لماذا تبقى [النتيجة] نادرة إلى هذا الحد؟",
  } },
  { id: "q4",  category: "question", text: {
    fr: "Tu fais [action] ? Cette vidéo est pour toi.",
    ar: "هل تفعل [الفعل]؟ هذا الفيديو لك.",
  } },
  { id: "q5",  category: "question", text: {
    fr: "Et si je te disais qu'en [durée], tu peux [résultat] ?",
    ar: "ماذا لو قلت لك أن في [المدة]، يمكنك [النتيجة]؟",
  } },
  { id: "q6",  category: "question", text: {
    fr: "Combien de fois t'as essayé [tâche] sans réussir ?",
    ar: "كم مرة جرّبت [المهمة] دون أن تنجح؟",
  } },
  { id: "q7",  category: "question", text: {
    fr: "Quel est le vrai prix de ton inaction sur [sujet] ?",
    ar: "ما هو الثمن الحقيقي لتقاعسك عن [الموضوع]؟",
  } },
  { id: "q8",  category: "question", text: {
    fr: "Tu es sûr que tu [croyance] ? Voici une autre lecture.",
    ar: "هل أنت متأكد أنك [الاعتقاد]؟ إليك قراءة أخرى.",
  } },
  { id: "q9",  category: "question", text: {
    fr: "Pourquoi certains explosent en [niche] et pas toi ?",
    ar: "لماذا ينفجر البعض في [التخصص] وأنت لا؟",
  } },
  { id: "q10", category: "question", text: {
    fr: "Tu fais partie des 5 % qui [comportement] ?",
    ar: "هل أنت من الـ 5٪ الذين [السلوك]؟",
  } },

  // ============================== URGENCE ==============================
  { id: "u1",  category: "urgency", text: {
    fr: "Si tu ne fais pas ça maintenant, tu vas le regretter.",
    ar: "إذا لم تفعل هذا الآن، ستندم.",
  } },
  { id: "u2",  category: "urgency", text: {
    fr: "Avant qu'il soit trop tard, regarde ça.",
    ar: "قبل فوات الأوان، شاهد هذا.",
  } },
  { id: "u3",  category: "urgency", text: {
    fr: "Le marché change. Voici comment t'adapter.",
    ar: "السوق يتغير. إليك كيف تتكيف.",
  } },
  { id: "u4",  category: "urgency", text: {
    fr: "Plus tu attends, plus ça te coûte.",
    ar: "كلما انتظرت أكثر، كلفك ذلك أكثر.",
  } },
  { id: "u5",  category: "urgency", text: {
    fr: "Ne fais surtout pas l'impasse sur ça en 2025.",
    ar: "لا تتجاهل هذا أبداً في 2025.",
  } },
  { id: "u6",  category: "urgency", text: {
    fr: "Le timing parfait pour [action], c'est maintenant.",
    ar: "التوقيت المثالي لـ [الفعل] هو الآن.",
  } },
  { id: "u7",  category: "urgency", text: {
    fr: "Si t'attends, quelqu'un d'autre va prendre ta place.",
    ar: "إذا انتظرت، شخص آخر سيأخذ مكانك.",
  } },
  { id: "u8",  category: "urgency", text: {
    fr: "Dernière chance avant que [opportunité] disparaisse.",
    ar: "الفرصة الأخيرة قبل أن تختفي [الفرصة].",
  } },
  { id: "u9",  category: "urgency", text: {
    fr: "Dans 6 mois, ce sera trop tard pour commencer.",
    ar: "بعد 6 أشهر، سيكون قد فات الأوان للبدء.",
  } },
  { id: "u10", category: "urgency", text: {
    fr: "Tout le monde fonce sur [tendance]. Toi aussi ?",
    ar: "الجميع يندفع نحو [الموضة]. وأنت أيضاً؟",
  } },
];

/**
 * Pick the localized text for a hook. Falls back to French if the locale
 * doesn't have a translation (defensive — shouldn't happen).
 */
export function hookText(hook: Hook, locale: Locale): string {
  return hook.text[locale] ?? hook.text.fr;
}

export function getHooksByCategory(category: HookCategory) {
  return HOOKS.filter((h) => h.category === category);
}

export function categoryLabel(category: HookCategory) {
  return HOOK_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function categoryEmoji(category: HookCategory) {
  return HOOK_CATEGORIES.find((c) => c.value === category)?.emoji ?? "💡";
}
