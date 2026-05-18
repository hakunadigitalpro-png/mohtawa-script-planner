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
    en: "No one's telling you this about [your topic].",
  } },
  { id: "c2",  category: "curiosity", text: {
    fr: "Le secret que [niche/concurrent] te cache.",
    ar: "السر الذي يخفيه [التخصص/المنافس] عنك.",
    en: "The secret [niche/competitor] doesn't want you to know.",
  } },
  { id: "c3",  category: "curiosity", text: {
    fr: "Voici ce que [audience] ignore complètement.",
    ar: "إليك ما يجهله [الجمهور] تماماً.",
    en: "Here's what most [audience] have no clue about.",
  } },
  { id: "c4",  category: "curiosity", text: {
    fr: "Ce que j'ai découvert va te surprendre.",
    ar: "ما اكتشفته سيفاجئك.",
    en: "What I found out is going to blow your mind.",
  } },
  { id: "c5",  category: "curiosity", text: {
    fr: "Tu n'imagines pas ce qui se passe quand…",
    ar: "لا يمكنك تخيل ما يحدث عندما…",
    en: "You won't believe what happens when…",
  } },
  { id: "c6",  category: "curiosity", text: {
    fr: "Ça, on me l'avait jamais dit.",
    ar: "هذا، لم يخبرني به أحد من قبل.",
    en: "Nobody ever told me this, so I'm telling you.",
  } },
  { id: "c7",  category: "curiosity", text: {
    fr: "La vérité sur [sujet] que personne ne dit.",
    ar: "الحقيقة حول [الموضوع] التي لا يقولها أحد.",
    en: "The truth about [topic] no one's saying out loud.",
  } },
  { id: "c8",  category: "curiosity", text: {
    fr: "Si je devais recommencer aujourd'hui, je ferais ça.",
    ar: "لو كان عليّ البدء من جديد اليوم، لفعلت هذا.",
    en: "If I had to start over today, here's exactly what I'd do.",
  } },
  { id: "c9",  category: "curiosity", text: {
    fr: "Le truc le plus sous-coté en [niche].",
    ar: "الشيء الأكثر تقليلاً من قيمته في [التخصص].",
    en: "The most underrated thing in [niche].",
  } },
  { id: "c10", category: "curiosity", text: {
    fr: "Voici ce que j'aurais aimé savoir il y a 5 ans.",
    ar: "إليك ما كنت أتمنى لو عرفته قبل 5 سنوات.",
    en: "Here's what I wish I knew 5 years ago.",
  } },

  // ============================ ERREURS ==============================
  { id: "e1",  category: "mistake", text: {
    fr: "3 erreurs que font 90 % des [audience].",
    ar: "3 أخطاء يرتكبها 90٪ من [الجمهور].",
    en: "3 mistakes 90% of [audience] are making right now.",
  } },
  { id: "e2",  category: "mistake", text: {
    fr: "Stop. Tu fais ça mal si tu [comportement].",
    ar: "توقف. أنت تفعل ذلك بشكل خاطئ إذا كنت [السلوك].",
    en: "Stop. You're doing it wrong if you [behavior].",
  } },
  { id: "e3",  category: "mistake", text: {
    fr: "Évite cette erreur que j'ai faite à mes débuts.",
    ar: "تجنب هذا الخطأ الذي ارتكبته في بداياتي.",
    en: "Don't make the same mistake I made when I started.",
  } },
  { id: "e4",  category: "mistake", text: {
    fr: "Pourquoi ton [sujet] ne marche pas (et comment fixer).",
    ar: "لماذا لا ينجح [الموضوع] الخاص بك (وكيف تصلحه).",
    en: "Why your [topic] isn't working (and how to fix it).",
  } },
  { id: "e5",  category: "mistake", text: {
    fr: "Si tu fais ça, arrête tout de suite.",
    ar: "إذا كنت تفعل هذا، توقف فوراً.",
    en: "If you're doing this, stop right now.",
  } },
  { id: "e6",  category: "mistake", text: {
    fr: "Tu perds du temps sur [sujet]. Voici pourquoi.",
    ar: "أنت تضيع وقتك على [الموضوع]. إليك السبب.",
    en: "You're wasting time on [topic]. Here's why.",
  } },
  { id: "e7",  category: "mistake", text: {
    fr: "L'erreur n°1 qui te coûte cher en [domaine].",
    ar: "الخطأ رقم 1 الذي يكلفك الكثير في [المجال].",
    en: "The #1 mistake costing you money in [field].",
  } },
  { id: "e8",  category: "mistake", text: {
    fr: "Personne ne devrait commencer [sujet] sans savoir ça.",
    ar: "لا أحد يجب أن يبدأ [الموضوع] دون معرفة هذا.",
    en: "Don't start [topic] until you know this.",
  } },
  { id: "e9",  category: "mistake", text: {
    fr: "Tu fais ça ? Alors tu sabotes tes résultats.",
    ar: "هل تفعل هذا؟ إذن أنت تخرّب نتائجك.",
    en: "Doing this? You're killing your own results.",
  } },
  { id: "e10", category: "mistake", text: {
    fr: "Le piège classique du [niche] (et comment l'éviter).",
    ar: "الفخ الكلاسيكي لـ [التخصص] (وكيف تتجنبه).",
    en: "The classic [niche] trap (and how to dodge it).",
  } },

  // ========================= TRANSFORMATION =========================
  { id: "t1",  category: "transformation", text: {
    fr: "Comment je suis passé de [A] à [B] en [durée].",
    ar: "كيف انتقلت من [أ] إلى [ب] في [المدة].",
    en: "How I went from [A] to [B] in [timeframe].",
  } },
  { id: "t2",  category: "transformation", text: {
    fr: "Avant, je faisais X. Maintenant, je fais Y.",
    ar: "من قبل كنت أفعل س. الآن أفعل ص.",
    en: "I used to do X. Now I do Y. Game changed.",
  } },
  { id: "t3",  category: "transformation", text: {
    fr: "De 0 à [résultat] : voici la méthode.",
    ar: "من 0 إلى [النتيجة]: إليك الطريقة.",
    en: "From 0 to [result]: here's the exact playbook.",
  } },
  { id: "t4",  category: "transformation", text: {
    fr: "J'ai testé [méthode] pendant 30 jours. Résultat ?",
    ar: "جرّبت [الطريقة] لمدة 30 يوماً. النتيجة؟",
    en: "I tried [method] for 30 days. Here's what happened.",
  } },
  { id: "t5",  category: "transformation", text: {
    fr: "Voici ce qui a tout changé dans mon [domaine].",
    ar: "إليك ما غيّر كل شيء في [مجالي].",
    en: "This one thing flipped everything in my [field].",
  } },
  { id: "t6",  category: "transformation", text: {
    fr: "Une habitude. Un résultat. Trois mois.",
    ar: "عادة واحدة. نتيجة واحدة. ثلاثة أشهر.",
    en: "One habit. One result. Three months.",
  } },
  { id: "t7",  category: "transformation", text: {
    fr: "Ma plus grosse leçon après [X années / projets].",
    ar: "أكبر درس تعلمته بعد [س سنوات / مشاريع].",
    en: "Biggest lesson I learned after [X years / projects].",
  } },
  { id: "t8",  category: "transformation", text: {
    fr: "Ce que personne ne te dit après ton premier [résultat].",
    ar: "ما لا يخبرك به أحد بعد [النتيجة] الأولى.",
    en: "What nobody warns you about after your first [result].",
  } },
  { id: "t9",  category: "transformation", text: {
    fr: "L'avant/après que je n'aurais jamais cru possible.",
    ar: "القبل/بعد الذي لم أكن أعتقد أنه ممكن أبداً.",
    en: "The before/after I never thought was possible.",
  } },
  { id: "t10", category: "transformation", text: {
    fr: "Voici le déclic qui a tout changé pour moi.",
    ar: "إليك الشرارة التي غيّرت كل شيء بالنسبة لي.",
    en: "Here's the moment that changed everything for me.",
  } },

  // ======================== LISTES / HOW-TO ========================
  { id: "l1",  category: "list", text: {
    fr: "5 façons de [résultat] sans [obstacle].",
    ar: "5 طرق لـ [النتيجة] دون [العائق].",
    en: "5 ways to [result] without [obstacle].",
  } },
  { id: "l2",  category: "list", text: {
    fr: "Top 3 [outils / astuces] que j'utilise tous les jours.",
    ar: "أفضل 3 [أدوات / نصائح] أستخدمها كل يوم.",
    en: "Top 3 [tools/tips] I use every single day.",
  } },
  { id: "l3",  category: "list", text: {
    fr: "Voici comment [résultat] en moins de [temps].",
    ar: "إليك كيف [النتيجة] في أقل من [الوقت].",
    en: "Here's how to [result] in less than [time].",
  } },
  { id: "l4",  category: "list", text: {
    fr: "3 étapes pour [objectif] (même en partant de zéro).",
    ar: "3 خطوات لـ [الهدف] (حتى لو بدأت من الصفر).",
    en: "3 steps to [goal] (even if you're starting from zero).",
  } },
  { id: "l5",  category: "list", text: {
    fr: "Les 5 règles à connaître absolument en [niche].",
    ar: "القواعد الـ 5 التي يجب معرفتها مطلقاً في [التخصص].",
    en: "The 5 rules you can't ignore in [niche].",
  } },
  { id: "l6",  category: "list", text: {
    fr: "10 secondes pour comprendre [concept].",
    ar: "10 ثوانٍ لفهم [المفهوم].",
    en: "[Concept] explained in 10 seconds.",
  } },
  { id: "l7",  category: "list", text: {
    fr: "Le framework que j'utilise pour [tâche].",
    ar: "الإطار الذي أستخدمه لـ [المهمة].",
    en: "The framework I use for [task].",
  } },
  { id: "l8",  category: "list", text: {
    fr: "Voici ma checklist avant chaque [moment clé].",
    ar: "إليك قائمتي المرجعية قبل كل [لحظة مفتاحية].",
    en: "My exact checklist before every [key moment].",
  } },
  { id: "l9",  category: "list", text: {
    fr: "Comment faire [X] comme un pro (en moins de [temps]).",
    ar: "كيف تفعل [س] كالمحترفين (في أقل من [الوقت]).",
    en: "How to [X] like a pro (in under [time]).",
  } },
  { id: "l10", category: "list", text: {
    fr: "3 hacks que [pro] utilisent en secret.",
    ar: "3 حيل يستخدمها [المحترفون] في الخفاء.",
    en: "3 hacks [pros] use behind the scenes.",
  } },

  // =========================== CONTROVERSE ===========================
  { id: "k1",  category: "controversy", text: {
    fr: "Tout le monde dit [X]. Et pourtant…",
    ar: "الجميع يقول [س]. ومع ذلك…",
    en: "Everyone says [X]. They're wrong.",
  } },
  { id: "k2",  category: "controversy", text: {
    fr: "Hot take : [opinion clivante].",
    ar: "رأي صادم: [رأي مثير للجدل].",
    en: "Hot take: [polarizing opinion].",
  } },
  { id: "k3",  category: "controversy", text: {
    fr: "[Niche] est mort. Voici pourquoi.",
    ar: "[التخصص] قد مات. إليك السبب.",
    en: "[Niche] is dead. Here's why.",
  } },
  { id: "k4",  category: "controversy", text: {
    fr: "Désolé, mais [croyance commune] est fausse.",
    ar: "آسف، ولكن [الاعتقاد الشائع] خاطئ.",
    en: "Sorry, but [common belief] is just wrong.",
  } },
  { id: "k5",  category: "controversy", text: {
    fr: "Tu veux la vraie raison ? Ça va te déplaire.",
    ar: "هل تريد السبب الحقيقي؟ لن يعجبك.",
    en: "Want the real reason? You're not gonna like it.",
  } },
  { id: "k6",  category: "controversy", text: {
    fr: "Personne n'ose le dire, alors je vais le faire.",
    ar: "لا أحد يجرؤ على قولها، إذن سأقولها أنا.",
    en: "Nobody has the guts to say this, so I will.",
  } },
  { id: "k7",  category: "controversy", text: {
    fr: "Arrêtez avec [tendance]. Voici pourquoi.",
    ar: "توقفوا عن [الموضة]. إليكم السبب.",
    en: "Stop with the [trend]. Here's why.",
  } },
  { id: "k8",  category: "controversy", text: {
    fr: "Ce qu'on t'a appris sur [sujet] est faux.",
    ar: "ما تم تعليمك إياه عن [الموضوع] خاطئ.",
    en: "What you've been taught about [topic] is a lie.",
  } },
  { id: "k9",  category: "controversy", text: {
    fr: "Je vais me faire des ennemis avec cette vidéo.",
    ar: "سأكسب أعداءً بهذا الفيديو.",
    en: "This video is gonna make me some enemies.",
  } },
  { id: "k10", category: "controversy", text: {
    fr: "Cette opinion va te faire grincer des dents.",
    ar: "هذا الرأي سيجعلك تصرّ على أسنانك.",
    en: "This opinion will make your skin crawl.",
  } },

  // ============================= QUESTION =============================
  { id: "q1",  category: "question", text: {
    fr: "Tu te demandes encore comment [objectif] ?",
    ar: "هل ما زلت تتساءل كيف [الهدف]؟",
    en: "Still wondering how to [goal]?",
  } },
  { id: "q2",  category: "question", text: {
    fr: "As-tu déjà ressenti [émotion] face à [situation] ?",
    ar: "هل شعرت يوماً بـ [الشعور] أمام [الموقف]؟",
    en: "Have you ever felt [emotion] when [situation]?",
  } },
  { id: "q3",  category: "question", text: {
    fr: "Pourquoi [résultat] reste-t-il aussi rare ?",
    ar: "لماذا تبقى [النتيجة] نادرة إلى هذا الحد؟",
    en: "Why is [result] still so rare?",
  } },
  { id: "q4",  category: "question", text: {
    fr: "Tu fais [action] ? Cette vidéo est pour toi.",
    ar: "هل تفعل [الفعل]؟ هذا الفيديو لك.",
    en: "Doing [action]? This one's for you.",
  } },
  { id: "q5",  category: "question", text: {
    fr: "Et si je te disais qu'en [durée], tu peux [résultat] ?",
    ar: "ماذا لو قلت لك أن في [المدة]، يمكنك [النتيجة]؟",
    en: "What if I told you in [timeframe], you could [result]?",
  } },
  { id: "q6",  category: "question", text: {
    fr: "Combien de fois t'as essayé [tâche] sans réussir ?",
    ar: "كم مرة جرّبت [المهمة] دون أن تنجح؟",
    en: "How many times have you tried [task] and failed?",
  } },
  { id: "q7",  category: "question", text: {
    fr: "Quel est le vrai prix de ton inaction sur [sujet] ?",
    ar: "ما هو الثمن الحقيقي لتقاعسك عن [الموضوع]؟",
    en: "What's doing nothing about [topic] really costing you?",
  } },
  { id: "q8",  category: "question", text: {
    fr: "Tu es sûr que tu [croyance] ? Voici une autre lecture.",
    ar: "هل أنت متأكد أنك [الاعتقاد]؟ إليك قراءة أخرى.",
    en: "Sure you [belief]? Here's another way to look at it.",
  } },
  { id: "q9",  category: "question", text: {
    fr: "Pourquoi certains explosent en [niche] et pas toi ?",
    ar: "لماذا ينفجر البعض في [التخصص] وأنت لا؟",
    en: "Why do some people blow up in [niche] and you don't?",
  } },
  { id: "q10", category: "question", text: {
    fr: "Tu fais partie des 5 % qui [comportement] ?",
    ar: "هل أنت من الـ 5٪ الذين [السلوك]؟",
    en: "Are you in the 5% who actually [behavior]?",
  } },

  // ============================== URGENCE ==============================
  { id: "u1",  category: "urgency", text: {
    fr: "Si tu ne fais pas ça maintenant, tu vas le regretter.",
    ar: "إذا لم تفعل هذا الآن، ستندم.",
    en: "Don't do this now and you'll regret it later.",
  } },
  { id: "u2",  category: "urgency", text: {
    fr: "Avant qu'il soit trop tard, regarde ça.",
    ar: "قبل فوات الأوان، شاهد هذا.",
    en: "Watch this before it's too late.",
  } },
  { id: "u3",  category: "urgency", text: {
    fr: "Le marché change. Voici comment t'adapter.",
    ar: "السوق يتغير. إليك كيف تتكيف.",
    en: "The market is shifting. Here's how to keep up.",
  } },
  { id: "u4",  category: "urgency", text: {
    fr: "Plus tu attends, plus ça te coûte.",
    ar: "كلما انتظرت أكثر، كلفك ذلك أكثر.",
    en: "Every day you wait is costing you more.",
  } },
  { id: "u5",  category: "urgency", text: {
    fr: "Ne fais surtout pas l'impasse sur ça en 2025.",
    ar: "لا تتجاهل هذا أبداً في 2025.",
    en: "Don't sleep on this in 2026.",
  } },
  { id: "u6",  category: "urgency", text: {
    fr: "Le timing parfait pour [action], c'est maintenant.",
    ar: "التوقيت المثالي لـ [الفعل] هو الآن.",
    en: "The perfect time to [action] is right now.",
  } },
  { id: "u7",  category: "urgency", text: {
    fr: "Si t'attends, quelqu'un d'autre va prendre ta place.",
    ar: "إذا انتظرت، شخص آخر سيأخذ مكانك.",
    en: "Wait too long and someone else takes your spot.",
  } },
  { id: "u8",  category: "urgency", text: {
    fr: "Dernière chance avant que [opportunité] disparaisse.",
    ar: "الفرصة الأخيرة قبل أن تختفي [الفرصة].",
    en: "Last chance before [opportunity] is gone.",
  } },
  { id: "u9",  category: "urgency", text: {
    fr: "Dans 6 mois, ce sera trop tard pour commencer.",
    ar: "بعد 6 أشهر، سيكون قد فات الأوان للبدء.",
    en: "In 6 months, it'll be too late to start.",
  } },
  { id: "u10", category: "urgency", text: {
    fr: "Tout le monde fonce sur [tendance]. Toi aussi ?",
    ar: "الجميع يندفع نحو [الموضة]. وأنت أيضاً؟",
    en: "Everyone's jumping on [trend]. You in?",
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
