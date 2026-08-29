import "server-only";

import { extractJsonBlock } from "@/lib/utils";
import type { GeneratedStrategy, FilmingGuide } from "@/lib/types";

/**
 * Wrappers minimalistes (fetch, pas de SDK) autour des API IA utilisées côté
 * serveur : Claude (Anthropic) pour la génération de texte, Groq (Whisper) pour
 * la transcription. Reste léger pour ne pas alourdir le bundle Vercel.
 */

// ===== Anthropic (Claude) — utilisé pour l'autopsie vidéo (feature premium) =====
export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Modèle configurable via env ANTHROPIC_MODEL. Défaut : Sonnet 4.6
// (même prix que 4.5 — 3$/15$ par 1M — mais meilleure qualité ; bon
// équilibre pour l'autopsie ET l'analyse de transcript). Pour Haiku
// (moins cher) ou Opus (plus puissant), définir ANTHROPIC_MODEL dans Vercel.
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// ===== Groq — transcription audio (Whisper), gratuit sans carte =====
// Claude ne transcrit PAS l'audio. On délègue la transcription à Groq
// (API compatible OpenAI), qui fait tourner Whisper large v3 turbo très
// vite et gratuitement (tier sans carte). La clé GROQ_API_KEY se crée sur
// console.groq.com sans moyen de paiement.
const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";

export class AiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AiError";
  }
}

/**
 * Vercel coupe la fonction à 60 s (plan Hobby) et rend alors une page 504
 * brute — l'utilisatrice perd son travail sans comprendre pourquoi. On coupe
 * donc NOUS-MÊMES avant, pour renvoyer un message lisible dans l'interface.
 */
export const AI_BUDGET_MS = 52_000;
/** En dessous, un appel n'a aucune chance d'aboutir : autant le dire tout de suite. */
const AI_MIN_MS = 6_000;
const AI_TIMEOUT_MESSAGE =
  "L'IA a mis trop de temps à répondre (le serveur coupe à 60 s). Réessaie — si ça recommence, raccourcis ton script ou découpe-le en deux vidéos.";

/** Échéance partagée par tous les appels d'une même requête. */
export function aiDeadline(): number {
  return Date.now() + AI_BUDGET_MS;
}

/** Signal d'abandon calé sur le temps qu'il reste avant l'échéance. */
export function aiSignal(deadline: number): AbortSignal {
  const msLeft = deadline - Date.now();
  if (msLeft < AI_MIN_MS) throw new AiError("timeout", AI_TIMEOUT_MESSAGE);
  return AbortSignal.timeout(msLeft);
}

/** Traduit l'échec d'un `fetch` vers l'API en erreur parlante. */
export function aiFetchError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
    return new AiError("timeout", AI_TIMEOUT_MESSAGE);
  }
  return new AiError("network", "Impossible de joindre l'IA. Réessaie.");
}

/**
 * Repères de dialecte tunisien (tounsi), à coller dans tout prompt qui
 * GÉNÈRE du texte neuf en arabe (pas dans les prompts d'ANALYSE qui
 * doivent matcher la langue/dialecte d'un transcript fourni par
 * l'utilisatrice — là, on cite fidèlement ce qui existe).
 *
 * Sans repère précis, "dialectes maghrébins inclus" tout seul laisse
 * Claude dériver vers un mélange marocain/algérien/égyptien/golfe (retour
 * utilisatrice : dialecte "très mauvais", pas authentiquement tunisien —
 * ex. "كاين"/"ديال"/"بغى"/le préfixe "كـ" du présent sont marocains, pas
 * tounsi). Kreatly cible d'abord une audience tunisienne — ce guide fixe
 * le défaut, pas un choix de dialecte configurable par marque pour
 * l'instant.
 */
const TUNISIAN_DIALECT_GUIDE = `Quand tu écris en arabe, c'est TOUJOURS en tounsi (dialecte tunisien) authentique — jamais un mélange avec l'algérien, le marocain, l'égyptien ou le golfe. Repères précis à respecter absolument :
- Futur : "باش" + verbe (jamais "غادي"/"راح").
- Possession : "متاع" (jamais "ديال").
- Vouloir : "حب"/"حبيت" (jamais "بغى"/"بغيت").
- "Il y a" : "فمّا" (jamais "كاين").
- Pouvoir : privilégie "نجّم" (تنجم/نجّمت/ينجم) — plus net et plus tounsi que "تقدر", qui sonne trop standard/importé.
- Présent : conjugaison directe (نمشي/تمشي/يمشي...), JAMAIS le préfixe "كـ" marocain ("كنمشي"/"كتمشي" = FAUX en tounsi).
- Toi (tu) : "إنتِ"/"انتي" (jamais "نتا").
- Vocabulaire courant tounsi à privilégier : "برشة" (beaucoup), "توا" (maintenant), "يزّي" (assez/ça suffit), "عادي" (normal), "صحيح" (vraiment/d'accord), "أهلا" (salut).
Si tu doutes d'un mot ou d'une tournure, préfère une formulation simple et clairement tounsié plutôt qu'un mot d'un autre dialecte.

Un bon copywriter tounsi ne bâcle JAMAIS l'argument pour aller vite. Pour un texte de vente/persuasion (corps de script, story, vlog...), développe l'idée sur PLUSIEURS phrases courtes qui s'enchaînent (une respiration = une phrase, comme à l'oral) — jamais un paragraphe compact qui résume tout en 2 lignes. Structure qui marche bien en tounsi, CHAQUE beat sur sa propre ligne (sépare-les avec un retour à la ligne "\\n\\n" DANS le texte que tu écris, jamais tout enchaîné sans respiration visuelle) :
1. Objection courante du public ("برشة ناس يقولولي...")
2. Tu recadres la vraie question
3. Tu expliques le POURQUOI concrètement, sur 2-3 phrases courtes
4. Une chute qui retourne l'idée (pas juste une reformulation plate de l'accroche)`;

export type GenerationLanguage = "fr" | "en" | "ar_msa" | "ar_tn";

/**
 * Voix de marque (issue de la Stratégie de contenu) injectée dans les
 * générations. Bloc conditionnel : rien n'est envoyé au modèle tant que la
 * marque n'a pas de stratégie, donc aucun token dépensé pour rien.
 */
function voiceInstruction(voice?: string): string {
  const v = voice?.trim();
  return v ? ` Respecte la VOIX DE MARQUE suivante dans tout ce que tu écris : ${v}.` : "";
}

/**
 * Consigne de langue explicite choisie par l'utilisatrice dans le générateur
 * IA (remplace l'ancienne auto-détection "langue du sujet, français par
 * défaut", qui laissait Claude deviner). "ar_tn" applique le guide dialecte
 * tounsi ; "ar_msa" l'exclut volontairement pour rester en arabe standard
 * (pas de tounsi ni d'autre dialecte).
 */
function languageInstruction(language?: GenerationLanguage): string {
  switch (language) {
    case "fr":
      return "Écris exclusivement en français.";
    case "en":
      return "Écris exclusivement en anglais.";
    case "ar_msa":
      return "Écris exclusivement en arabe standard moderne (fus7a) : clair, correct, accessible à tous les pays arabophones — PAS de dialecte (ni tounsi, ni autre), pas d'expressions familières régionales.";
    case "ar_tn":
      return `Écris exclusivement en arabe. ${TUNISIAN_DIALECT_GUIDE}`;
    default:
      return `Écris dans la langue du sujet (français par défaut). ${TUNISIAN_DIALECT_GUIDE}`;
  }
}

/* =========================================================================
   Prompts — Reel
   ========================================================================= */

/**
 * Script de Reel SIMPLIFIÉ : 3 blocs seulement (Accroche / Corps / Outro),
 * pour coller à l'onglet Script. Généré via CLAUDE (la carte de
 * l'utilisatrice n'est acceptée que chez Anthropic ; OpenAI est inaccessible).
 * Multilingue FR + arabe, ton patron-de-PME (zéro jargon).
 */
export type StoryboardSceneGeneration = {
  description: string;
  camera_angle: string;
  expression: string;
  movement: string;
  /** Label EXACT d'un setup de tournage (Mes setups) le plus adapté à cette
   *  scène, si la marque en a — sert à récupérer la photo de référence du
   *  lieu à l'application. Absent si aucun setup ne convient. */
  preset_label?: string;
};

/** `equipment` : matériel RÉEL de CE setup précis (0051) — un setup "face
 *  fenêtre" peut très bien n'en avoir aucun, c'est normal, pas une lacune. */
export type ScenePresetHint = { label: string; hint?: string; equipment?: string };

function presetsPromptBlock(presets?: ScenePresetHint[]): string {
  if (!presets || presets.length === 0) return "";
  return `\n\nSetups de tournage disponibles pour cette marque (lieux réutilisables) :\n${presets
    .map((p) => {
      const bits = [p.hint, p.equipment ? `matériel : ${p.equipment}` : "aucun matériel (lumière naturelle par ex.)"];
      return `- "${p.label}" — ${bits.filter(Boolean).join(" · ")}`;
    })
    .join("\n")}`;
}

/**
 * Règles de découpage partagées entre generateReel(includeStoryboard) — qui
 * génère le script ET le découpe dans le même appel — et
 * segmentScriptIntoStoryboard — qui découpe un script DÉJÀ ÉCRIT par
 * l'utilisatrice (Guidé ou Libre) sans le regénérer.
 *
 * `presets` (Mes setups, optionnel) : quand la marque a des lieux de
 * tournage réutilisables, chaque scène reçoit le "preset_label" du plus
 * adapté — sert à récupérer sa photo de référence à l'application. Le
 * matériel vit sur CHAQUE setup (0051, pas sur la marque) : deux setups de
 * la même marque peuvent avoir un matériel complètement différent (l'un
 * équipé, l'autre à la lumière naturelle) — jamais de layout matériel
 * unique pour toute la vidéo.
 */
function storyboardSegmentationRules(presets?: ScenePresetHint[]): string {
  const hasPresets = Boolean(presets && presets.length > 0);
  const presetsWithEquipment = (presets ?? []).filter((p) => p.equipment?.trim());
  return `- Découpe par BEAT naturel (une idée/phrase forte = une scène), pas rigidement par accroche/corps/outro. Vise 4 à 7 scènes pour 30-60s.
- Pour chaque scène : "description" (l'action + ce qui est dit, en 1 phrase concrète), "camera_angle" (cadrage, TRÈS court : "Plan rapproché, face caméra"), "expression" (jeu de visage à adopter, TRÈS court : "Souriant, sourcils levés"), "movement" (gestuelle, TRÈS court : "Main sur le cœur, hoche la tête").
- Le "filming_guide" est un résumé global du tournage (pas la durée — elle est calculée ailleurs à partir du script, ne l'invente pas) : "lighting" (conseil d'éclairage court), "camera_style" (style de plan général pour toute la vidéo), "pacing" (rythme/rétention, ex : "Change de plan toutes les 3-4s pour garder l'attention"), "energy" (niveau d'énergie à tenir), "tip" (UN conseil pro actionnable).
- Reste TRÈS court sur chaque champ (une poignée de mots, pas une phrase longue) — c'est un pense-bête à lire pendant le tournage, pas un article.
- Si le script est en arabe : "camera_angle", "expression", "movement" et les champs de "filming_guide" doivent être du VRAI vocabulaire arabe de tournage, PAS une translittération phonétique de termes français en lettres arabes (mauvais, à ne jamais faire : "بلان رابروشي", "فاس كاميرا" ; bon : "لقطة قريبة", "مواجهة الكاميرا").
- Remplis TOUJOURS "camera_position" : où poser le téléphone/la caméra vu du DESSUS par rapport à la personne qui filme, parmi les 8 mêmes positions ("face" le plus souvent — cadrage face caméra classique — sauf si le style de plan demande un angle différent, ex : "droite" pour un profil).${
    hasPresets
      ? `\n- Pour CHAQUE scène, assigne le "preset_label" du setup de tournage le plus adapté parmi ceux listés plus bas (reprends le label EXACTEMENT, aucune reformulation) — varie entre les setups disponibles selon ce qui convient à chaque scène, ne mets pas toujours le même. Si vraiment aucun ne convient pour une scène précise, omets "preset_label" plutôt que de deviner au hasard.`
      : ""
  }${
    presetsWithEquipment.length > 0
      ? `\n- Remplis AUSSI "preset_layouts" : UN élément par setup listé plus bas qui a du matériel (ignore ceux sans matériel — rien à placer). Pour "${presetsWithEquipment.map((p) => p.label).join('", "')}" : reprends le "preset_label" EXACT, et pour CHAQUE élément de matériel de CE setup (reprends son nom exact), une position vue du DESSUS autour de la personne qui filme À CE LIEU, parmi ces 8 seulement : "face" (à côté/juste derrière la caméra, face à la personne), "avant_droite", "droite", "arriere_droite", "arriere", "arriere_gauche", "gauche", "avant_gauche". "note" : conseil très court (hauteur, angle, intensité). Ne mélange JAMAIS le matériel de deux setups différents dans un même "preset_layouts".
- RÈGLE D'ÉCLAIRAGE NON NÉGOCIABLE (erreur classique, ne la commets pas) : la lumière PRINCIPALE va TOUJOURS DEVANT la personne — "avant_droite" ou "avant_gauche" (45° du visage, le plus flatteur), ou "face" à défaut. JAMAIS "arriere"/"arriere_droite"/"arriere_gauche" : derrière = contre-jour = visage sombre, la vidéo est ratée. Une FENÊTRE (ou toute lumière du jour) compte TOUJOURS comme lumière principale : elle doit éclairer le visage, donc être devant la personne — ne dis jamais de se mettre dos à la fenêtre ni de la mettre "en arrière-plan". Une position arrière n'est acceptable QUE pour une lumière d'accentuation SECONDAIRE, et seulement s'il y a déjà une lumière principale devant. Applique la même logique dans "lighting" et dans les "note".`
      : ""
  }`;
}

/**
 * Gabarit JSON du "filming_guide", partagé entre generateReel et
 * segmentScriptIntoStoryboard — "camera_position" est TOUJOURS demandé
 * (utile même sans matériel configuré), "preset_layouts" UNIQUEMENT si au
 * moins un setup a du matériel (sinon le modèle produirait un champ vide).
 */
function filmingGuideJsonTemplate(presetsWithEquipment: ScenePresetHint[]): string {
  return `{
      "lighting": "...",
      "camera_style": "...",
      "pacing": "...",
      "energy": "...",
      "tip": "...",
      "camera_position": "face|avant_droite|droite|arriere_droite|arriere|arriere_gauche|gauche|avant_gauche"${
        presetsWithEquipment.length > 0
          ? `,
      "preset_layouts": [
        { "preset_label": "label exact du setup", "equipment_layout": [
          { "label": "nom exact repris du matériel de CE setup", "position": "face|avant_droite|droite|arriere_droite|arriere|arriere_gauche|gauche|avant_gauche", "note": "..." }
        ] }
      ]`
          : ""
      }
    }`;
}

export type ReelGeneration = {
  accroche: string;
  corps: string;
  outro: string;
  /** Présent seulement si `includeStoryboard` était demandé (migration 0047). */
  storyboard?: {
    scenes: StoryboardSceneGeneration[];
    filming_guide: FilmingGuide;
  };
};

/**
 * Génère un script de Reel simplifié (Accroche / Corps / Outro), et — si
 * `includeStoryboard` est coché — découpe CE MÊME script en scènes de
 * storyboard tournage-prêtes (cadrage + expression + mouvement) plus un
 * résumé de tournage (éclairage, style caméra, rythme, énergie, conseil).
 * Un seul appel Claude dans les deux cas (pas de 2e appel séparé) : la
 * cible n'a pas besoin de savoir ce qu'est un storyboard pour en avoir un.
 */
/**
 * Rappel du cadre du contenu : son thème et son objectif. Ces deux champs
 * sont remplis par l'utilisatrice dans l'onglet Plan et étaient jusqu'ici
 * ignorés par les générateurs — on pouvait ranger un contenu dans
 * « Coulisses » et récupérer un script qui n'avait rien de coulisses.
 * Bloc conditionnel : rien n'est ajouté au prompt si rien n'est renseigné.
 */
function briefBlock(theme?: string, objective?: string): string {
  const lines: string[] = [];
  if (theme?.trim()) {
    lines.push(
      `Thème de contenu : "${theme.trim()}". Le script doit visiblement appartenir à ce thème.`,
    );
  }
  if (objective?.trim()) {
    lines.push(`Objectif de ce contenu : ${objective.trim()}.`);
  }
  if (!lines.length) return "";
  // Une ligne vide devant, pour que le bloc se détache du reste du prompt.
  return lines.map((line) => `
${line}`).join("");
}

export function generateReel(opts: {
  topic: string;
  audience?: string;
  platform?: string;
  /** Thème de contenu choisi dans l'onglet Plan. */
  theme?: string;
  /** Objectif du contenu, choisi dans l'onglet Plan. */
  objective?: string;
  includeStoryboard?: boolean;
  language?: GenerationLanguage;
  presets?: ScenePresetHint[];
  voice?: string;
}): Promise<ReelGeneration> {
  const audience =
    opts.audience?.trim() || "des clients potentiels sur les réseaux";
  const platform = opts.platform?.trim() || "Instagram / TikTok";
  const includeStoryboard = Boolean(opts.includeStoryboard);
  const hasPresets = includeStoryboard && Boolean(opts.presets?.length);
  const presetsWithEquipment = includeStoryboard
    ? (opts.presets ?? []).filter((p) => p.equipment?.trim())
    : [];

  const system = `Tu es un expert en scripts de Reels/TikTok qui arrêtent le scroll, MULTILINGUE : français, anglais et arabe. Tu écris pour un PATRON DE PETITE ENTREPRISE (pas un expert marketing) : simple, direct, humain, orienté valeur, ZÉRO jargon. Un script se dit à voix haute en 30-60 secondes, phrases courtes, une idée par phrase.

Structure en 3 parties SEULEMENT :
- Accroche : les 2 premières secondes qui stoppent le scroll (tension, curiosité ou promesse concrète).
- Corps : le développement, dans l'ordre où le dire.
- Outro : la fermeture + un appel à l'action clair.
${
  includeStoryboard
    ? `
Tu découpes AUSSI ce script en un STORYBOARD tournage-prêt, pour quelqu'un qui n'a jamais filmé et ne sait pas ce qu'est un storyboard — il doit pouvoir filmer juste en suivant tes instructions, sans réfléchir :
${storyboardSegmentationRules(opts.presets)}`
    : ""
}
${voiceInstruction(opts.voice)}${languageInstruction(opts.language)} Réponds UNIQUEMENT avec un objet JSON valide, rien autour.`;

  const user = `Sujet de la vidéo : "${opts.topic}".
Plateforme : ${platform}
Audience : ${audience}${briefBlock(opts.theme, opts.objective)}${includeStoryboard ? presetsPromptBlock(opts.presets) : ""}

Renvoie UNIQUEMENT ce JSON (sans markdown) :
{
  "accroche": "La phrase d'accroche qui arrête le scroll (1 phrase forte, ≤ 2s)",
  "corps": "Le cœur du script : développe l'idée en phrases courtes, dans l'ordre où la dire. 30-45s. Sépare les beats par des \\n\\n (jamais un seul bloc compact).",
  "outro": "La fermeture + un appel à l'action clair (sauvegarde, commente, DM…)"${
    includeStoryboard
      ? `,
  "storyboard": {
    "scenes": [
      { "description": "...", "camera_angle": "...", "expression": "...", "movement": "..."${hasPresets ? `, "preset_label": "..."` : ""} }
    ],
    "filming_guide": ${filmingGuideJsonTemplate(presetsWithEquipment)}
  }`
      : ""
  }
}`;

  const maxTokens = includeStoryboard
    ? 3000 + (hasPresets ? 300 : 0) + presetsWithEquipment.length * 150
    : 2000;
  return geminiEnabled()
    ? callGeminiJSON<ReelGeneration>(
        system,
        user,
        maxTokens,
        reelSchema(
          includeStoryboard,
          hasPresets,
          presetsWithEquipment.length > 0,
        ),
      )
    : callClaudeJSON<ReelGeneration>(system, user, maxTokens);
}

export type StoryboardSegmentation = {
  scenes: StoryboardSceneGeneration[];
  filming_guide: FilmingGuide;
};

/**
 * Découpe un script DÉJÀ ÉCRIT par l'utilisatrice (Guidé ou Libre) en
 * storyboard tournage-prêt, SANS le regénérer ni le corriger. Complète
 * generateReel(includeStoryboard) — qui ne marche que sur un script généré
 * par l'IA au même moment — pour le cas où le script a été écrit à la main.
 */
export function segmentScriptIntoStoryboard(opts: {
  script: string;
  presets?: ScenePresetHint[];
}): Promise<StoryboardSegmentation> {
  const hasPresets = Boolean(opts.presets?.length);
  const presetsWithEquipment = (opts.presets ?? []).filter((p) => p.equipment?.trim());
  const system = `Tu es un expert en réalisation de Reels/TikTok. Tu prends un script DÉJÀ ÉCRIT par l'utilisatrice — tu ne le réécris PAS, tu ne le corriges PAS, tu ne changes RIEN au fond ni au texte — et tu le découpes en STORYBOARD tournage-prêt, pour quelqu'un qui n'a jamais filmé et ne sait pas ce qu'est un storyboard — il doit pouvoir filmer juste en suivant tes instructions, sans réfléchir :
${storyboardSegmentationRules(opts.presets)}
Écris tes réponses (description, cadrage, expression, mouvement, résumé de tournage) dans la MÊME langue que le script fourni (ne traduis pas). Si le script fourni est en arabe : ${TUNISIAN_DIALECT_GUIDE} Réponds UNIQUEMENT avec un objet JSON valide, rien autour.`;

  const user = `Script à découper (ne pas réécrire, juste segmenter en scènes) :
"""
${opts.script}
"""${presetsPromptBlock(opts.presets)}

Renvoie UNIQUEMENT ce JSON (sans markdown) :
{
  "scenes": [
    { "description": "...", "camera_angle": "...", "expression": "...", "movement": "..."${hasPresets ? `, "preset_label": "..."` : ""} }
  ],
  "filming_guide": ${filmingGuideJsonTemplate(presetsWithEquipment)}
}`;

  return callClaudeJSON<StoryboardSegmentation>(
    system,
    user,
    2500 + (hasPresets ? 300 : 0) + presetsWithEquipment.length * 150,
  );
}

/* =========================================================================
   Prompts — Story
   ========================================================================= */

export type StoryGeneration = {
  objective: string;
  cta_soft: string;
  slides: { slot: number; body: string }[];
};

export function generateStory(opts: {
  topic: string;
  audience?: string;
  language?: GenerationLanguage;
  voice?: string;
}): Promise<StoryGeneration> {
  const audience = opts.audience?.trim() || "ton audience sur les réseaux";

  const system = `Tu es un expert en Stories Instagram/TikTok, MULTILINGUE : français, anglais et arabe. Tu écris pour un PATRON DE PETITE ENTREPRISE (pas un expert) : ton simple, authentique, conversationnel, ZÉRO jargon. Tu crées une séquence de 5 stories qui tiennent en haleine jusqu'au CTA.${voiceInstruction(opts.voice)} ${languageInstruction(opts.language)} Réponds UNIQUEMENT avec un objet JSON valide, rien autour.`;

  const user = `Sujet : "${opts.topic}".
Audience : ${audience}

Les 5 stories :
1. Hook visuel + promesse ou question
2. Mise en contexte / révélation
3. Le contenu de valeur / exemple
4. Conseil clé ou ressource
5. Call to action (sticker, DM, swipe…)

Renvoie UNIQUEMENT ce JSON (sans markdown) :
{
  "objective": "L'objectif de la séquence en 1 phrase",
  "cta_soft": "L'action douce souhaitée (sticker question, DM, etc.)",
  "slides": [
    { "slot": 1, "body": "Texte de la story 1 (court, percutant)" },
    { "slot": 2, "body": "Texte de la story 2" },
    { "slot": 3, "body": "Texte de la story 3" },
    { "slot": 4, "body": "Texte de la story 4" },
    { "slot": 5, "body": "Texte de la story 5 (avec call to action)" }
  ]
}`;

  return geminiEnabled()
    ? callGeminiJSON<StoryGeneration>(system, user, 1500, STORY_SCHEMA)
    : callClaudeJSON<StoryGeneration>(system, user, 1500);
}

/* =========================================================================
   Autopsie vidéo — API Claude (Anthropic)
   ========================================================================= */

export type AutopsyInput = {
  title: string;
  platform: string | null;
  /** Stats brutes saisies par l'user (toutes optionnelles). */
  stats: {
    views?: number | null;
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
    saves?: number | null;
    retention?: number | null;
  };
  transcript: string;
  /** URLs publiques des captures d'insights — lues par Claude (vision). */
  insightsImageUrls?: string[];
};

/**
 * Liste les modèles accessibles par la clé API courante (GET /v1/models).
 * Utilisé pour auto-diagnostiquer un 404 "modèle inconnu" : on affiche à
 * l'utilisateur exactement quels identifiants son compte peut utiliser.
 */
async function listAnthropicModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: { id?: string }[] };
    return (body.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

/**
 * Appelle l'API Claude pour produire l'autopsie d'une vidéo : croise le
 * wording (transcript) avec les stats pour expliquer pourquoi ça marche
 * ou rate. Renvoie un texte formaté (avec emojis de section), pensé pour
 * un rendu en whitespace-pre-wrap (pas de markdown lourd).
 */
export async function generateAutopsy(input: AutopsyInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "no_api_key",
      "L'IA d'analyse n'est pas configurée. Ajoute ANTHROPIC_API_KEY dans Vercel et redéploie.",
    );
  }

  if (!input.transcript || input.transcript.trim().length < 10) {
    throw new AiError(
      "empty_transcript",
      "Colle le transcript de la vidéo (ce qui est dit) avant de lancer l'analyse.",
    );
  }

  const system = `Tu es un analyste expert en contenu vidéo short-form (Reels, TikTok, Shorts), MULTILINGUE. Tu maîtrises aussi bien le français que l'arabe — y compris les dialectes maghrébins (tunisien, algérien, marocain) et l'arabe standard. Tu connais les codes culturels, l'humour, le rythme oral et les déclencheurs émotionnels propres à CHAQUE marché. Ton job : faire l'AUTOPSIE d'une vidéo pour comprendre POURQUOI elle performe ou échoue, au niveau du WORDING (ce qui est dit), pas de la technique de montage.

RÈGLE N°1 — TU NE REFUSES JAMAIS D'ANALYSER.
Quelles que soient la langue, le nombre de vues ou les données disponibles, tu produis TOUJOURS une analyse utile. Une vidéo à 200 vues mérite autant d'analyse qu'une vidéo à 100k. Si les données sont limitées, tu analyses le WORDING sur ses mérites intrinsèques (force du hook, structure, rythme, clarté de la promesse) et tu signales simplement ton niveau de confiance. Ne demande JAMAIS "plus de données" comme excuse pour ne pas analyser.

LANGUE :
- Analyse le contenu DANS SA LANGUE D'ORIGINE (un transcript en tunisien s'analyse en tant que contenu tunisien, avec ses codes — pas en le traduisant).
- RÉPONDS dans la même langue que le transcript : transcript en arabe → réponds en arabe ; transcript en français → réponds en français. Si le transcript mélange les deux (arabizi, code-switching), réponds dans la langue dominante.
- Pour le hook/script NEUF que tu proposes dans "✨ TA PROCHAINE VIDÉO" (pas une citation du transcript) : si tu écris en arabe et que rien dans le transcript n'indique clairement un autre dialecte précis, ${TUNISIAN_DIALECT_GUIDE}

TRANSCRIPT IMPARFAIT :
Les transcripts viennent souvent de sous-titres auto (arabizi, dialecte) et sont partiellement corrompus/troués. Si c'est le cas : commence par 1-2 phrases qui EXPLICITENT ton interprétation de l'intention de la vidéo ("Voici ce que je comprends : ..."), invite à corriger si c'est faux, PUIS analyse sur cette base. N'analyse jamais du charabia au pied de la lettre.

LIS LES CHIFFRES COMME UN ANALYSTE (le plus important) :
Ne te contente pas de réciter les stats — CALCULE et INTERPRÈTE :
- Ratio VUES / PORTÉE : si > 1, beaucoup de gens ont revu/rewind la vidéo → signal de valeur très fort. Si ≈ portée, vue unique.
- Taux d'engagement sur la portée : (likes+comm+partages+saves) / portée. >3% = au-dessus de la moyenne pour de l'expertise/B2B.
- Saves et partages = métriques de VALEUR ("je garde pour plus tard" / "je dois montrer ça"). Un fort taux de saves malgré une rétention faible = le SUJET est bon mais le traitement/hook est cassé.
- COURBE DE RÉTENTION dans la capture : Instagram/TikTok montre TA courbe vs une courbe "type/baseline". Lis si ta courbe est AU-DESSUS ou EN-DESSOUS de la baseline, et À QUEL MOMENT elle croise.
- FORME UNE THÈSE (l'insight le plus précieux) : la vidéo a-t-elle gagné par le HOOK (pic précoce, rétention haute au début) ou par le FOND (courbe plate au début qui monte lentement via partages/saves) ? Dis-le explicitement. "Victoire de fond, pas de hook" est un insight en or.
- VUE MOYENNE vs DURÉE : calcule le % réellement regardé (ex : 11s sur ~30s ≈ 37%). Une vue moyenne courte = décrochage précoce = problème de hook, même si le score final est bon.

LABEL DE PERFORMANCE : si la plateforme indique un verdict ("plus que d'habitude" / "comparable" / "moins"), prends-le comme la VÉRITÉ. Si l'user croit que la vidéo a "cartonné" mais que le label dit "comparable/moyen", DIS-LE franchement et recadre. C'est ton rôle d'analyste honnête.

WORDING :
- Cite TOUJOURS les phrases/expressions EXACTES entre guillemets. Jamais de généralité ("ton hook est bon"). Dis QUELLE phrase et POURQUOI.
- Distingue promesse de PROCESSUS ("je vais vous montrer comment se passe X") = faible, de promesse de TENSION (erreur, secret, chiffre, contre-pied) = forte.
- Bannis les conseils évidents. Vise l'insight NON-ÉVIDENT.

FORMAT DE SORTIE (texte simple, PAS de markdown ## ni ** — garde les emojis ; TRADUIS les titres dans la langue de ta réponse) :

📈 CE QUE DISENT VRAIMENT TES CHIFFRES
- Les ratios calculés + la lecture de la courbe + TA THÈSE (gagné par hook ou par fond ?). Recadre le label si besoin.

✅ CE QUI A MARCHÉ
- [phrase/expression exacte] → pourquoi ça capte (avec la stat qui le prouve)

❌ CE QUI A PROBABLEMENT COÛTÉ DES VUES
- [phrase exacte ou moment] → où/pourquoi les gens décrochent (croisé avec la vue moyenne / la courbe)

🎯 LA RÈGLE À RETENIR
- 1 seule règle actionnable, tirée du fait le plus dur dont tu disposes

✨ TA PROCHAINE VIDÉO
- Hook (phrase exacte) + angle + structure en 3 points qui corrige ce qui fuit en gardant ce qui marche

📊 CONFIANCE : [élevée / moyenne / faible] — 1 phrase sur ce qui renforcerait l'analyse`;

  const s = input.stats;
  const statsLines = [
    s.views != null ? `Vues : ${s.views}` : null,
    s.likes != null ? `Likes : ${s.likes}` : null,
    s.comments != null ? `Commentaires : ${s.comments}` : null,
    s.shares != null ? `Partages : ${s.shares}` : null,
    s.saves != null ? `Enregistrements : ${s.saves}` : null,
    s.retention != null ? `Rétention moyenne : ${s.retention}%` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const images = (input.insightsImageUrls ?? []).filter(Boolean);

  const user = `VIDÉO À ANALYSER

Titre : ${input.title || "(sans titre)"}
Plateforme : ${input.platform || "(non précisée)"}
Stats saisies : ${statsLines || "(aucune — utilise les captures)"}
${
  images.length > 0
    ? `${images.length} capture(s) d'écran des insights jointe(s) ci-dessous. LIS-LES attentivement : extrais-en la courbe de rétention, la vue moyenne, la durée, le label de performance et tous les chiffres. Croise tout ça avec le transcript.`
    : "Aucune capture fournie — analyse le wording sur ses mérites et signale une confiance plus faible."
}

Transcript (ce qui est dit dans la vidéo) :
"""
${input.transcript.trim()}
"""

Fais l'autopsie de cette vidéo en suivant exactement le format demandé.`;

  // Contenu du message : texte + toutes les captures d'insights pour que
  // Claude (multimodal) lise la courbe + les stats + le label directement.
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "url"; url: string } };
  const content: ContentBlock[] = [{ type: "text", text: user }];
  for (const url of images) {
    content.push({ type: "image", source: { type: "url", url } });
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        // 2000 : compromis profondeur / latence. 3000 + plusieurs images
        // dépassait les 60s max de Vercel Hobby (timeout). 2000 garde une
        // bonne profondeur tout en restant sous la limite.
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content }],
      }),
      signal: aiSignal(aiDeadline()),
    });
  } catch (e) {
    throw aiFetchError(e);
  }

  if (!res.ok) {
    const status = res.status;
    if (status === 401) {
      throw new AiError(
        "auth",
        "Clé Anthropic invalide. Vérifie ANTHROPIC_API_KEY.",
      );
    }
    if (status === 429) {
      throw new AiError(
        "rate_limit",
        "Quota Anthropic atteint ou trop de requêtes. Réessaie dans une minute.",
      );
    }
    // 404 = modèle inconnu pour ce compte. On liste les modèles
    // réellement disponibles pour que l'user sache quoi mettre dans
    // ANTHROPIC_MODEL (au lieu de deviner).
    if (status === 404) {
      const models = await listAnthropicModels(apiKey);
      const hint =
        models.length > 0
          ? ` Modèles disponibles sur ton compte : ${models.join(", ")}. Mets-en un dans ANTHROPIC_MODEL (Vercel) puis redéploie.`
          : " Impossible de lister tes modèles (vérifie que ta clé a accès à l'API Messages).";
      throw new AiError(
        "model_not_found",
        `Le modèle "${ANTHROPIC_MODEL}" n'est pas accessible.${hint}`,
      );
    }
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body?.error?.message ? ` : ${body.error.message}` : "";
    } catch {
      // ignore
    }
    throw new AiError("api", `Erreur Anthropic (${status})${detail}.`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();

  if (!text) throw new AiError("empty", "Réponse vide de l'IA d'analyse.");
  return text;
}

/* =========================================================================
   Transcription Groq (Whisper) — audio → texte
   ========================================================================= */

/**
 * Transcrit une vidéo/audio en texte via Groq (Whisper large v3 turbo).
 * `fileUrl` = URL publique du fichier (uploadé sur Supabase Storage côté
 * client). On le télécharge côté serveur puis on le pousse en multipart à
 * Groq — la clé Groq ne touche jamais le navigateur.
 *
 * Gratuit (tier Groq sans carte). Limite ~25 Mo par fichier sur le gratuit.
 */
export async function transcribeWithGroq(
  fileUrl: string,
  filename = "audio.mp4",
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "no_api_key",
      "La transcription n'est pas configurée. Ajoute GROQ_API_KEY dans Vercel et redéploie.",
    );
  }

  // 1. Récupère le fichier (uploadé sur Supabase Storage)
  let fileRes: Response;
  try {
    fileRes = await fetch(fileUrl);
  } catch {
    throw new AiError("network", "Impossible de récupérer la vidéo. Réessaie.");
  }
  if (!fileRes.ok) {
    throw new AiError("api", "Téléchargement de la vidéo échoué.");
  }
  const blob = await fileRes.blob();

  // 2. Envoie à Groq Whisper (multipart). Pas de `language` forcée :
  // Whisper auto-détecte (FR, arabe, dialectes).
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", GROQ_WHISPER_MODEL);
  form.append("response_format", "json");

  let res: Response;
  try {
    res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch {
    throw new AiError(
      "network",
      "Impossible de joindre le service de transcription. Réessaie.",
    );
  }

  if (!res.ok) {
    const status = res.status;
    if (status === 401) {
      throw new AiError("auth", "Clé Groq invalide. Vérifie GROQ_API_KEY.");
    }
    if (status === 413) {
      throw new AiError(
        "too_large",
        "Vidéo trop lourde pour la transcription gratuite (max ~25 Mo). Prends un extrait plus court.",
      );
    }
    if (status === 429) {
      throw new AiError(
        "rate_limit",
        "Limite de transcription atteinte. Réessaie dans un moment.",
      );
    }
    let detail = "";
    try {
      const b = (await res.json()) as { error?: { message?: string } };
      detail = b?.error?.message ? ` : ${b.error.message}` : "";
    } catch {
      // ignore
    }
    throw new AiError("api", `Erreur de transcription (${status})${detail}.`);
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (!text) {
    throw new AiError(
      "empty",
      "Transcription vide — la vidéo a-t-elle du son parlé ?",
    );
  }
  return text;
}

/* =========================================================================
   Analyse de vidéo de référence — API Claude
   ========================================================================= */

/**
 * Appel Claude texte→texte (sans images). Helper interne pour les analyses
 * basées uniquement sur du texte (ne touche pas à generateAutopsy qui, lui,
 * envoie aussi des captures).
 */
async function callClaudeRaw(
  system: string,
  userText: string,
  maxTokens: number,
  deadline: number = aiDeadline(),
): Promise<{ text: string; stopReason: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "no_api_key",
      "L'IA d'analyse n'est pas configurée. Ajoute ANTHROPIC_API_KEY dans Vercel et redéploie.",
    );
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userText }],
      }),
      signal: aiSignal(deadline),
    });
  } catch (e) {
    throw aiFetchError(e);
  }

  if (!res.ok) {
    const status = res.status;
    if (status === 401) {
      throw new AiError(
        "auth",
        "Clé Anthropic invalide. Vérifie ANTHROPIC_API_KEY.",
      );
    }
    if (status === 429) {
      throw new AiError(
        "rate_limit",
        "Quota Anthropic atteint ou trop de requêtes. Réessaie dans une minute.",
      );
    }
    let detail = "";
    try {
      const b = (await res.json()) as { error?: { message?: string } };
      detail = b?.error?.message ? ` : ${b.error.message}` : "";
    } catch {
      // ignore
    }
    throw new AiError("api", `Erreur Anthropic (${status})${detail}.`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string | null;
  };
  const text = data.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new AiError("empty", "Réponse vide de l'IA.");
  return { text, stopReason: data.stop_reason ?? null };
}

async function callClaudeText(
  system: string,
  userText: string,
  maxTokens: number,
): Promise<string> {
  const { text } = await callClaudeRaw(system, userText, maxTokens);
  return text;
}

/**
 * Comme callClaudeText mais force une sortie JSON. Claude n'a pas de mode
 * "json_object" natif (contrairement à OpenAI) → on demande du JSON pur dans
 * le prompt, puis on extrait défensivement : on retire un éventuel bloc
 * ```json … ```, sinon on prend du premier "{" au dernier "}".
 *
 * Si la réponse est coupée avant la fin (stop_reason "max_tokens" — arrive
 * sur les JSON volumineux comme la stratégie de marque), on retente UNE fois
 * avec le double de budget avant d'abandonner : ça évite une erreur "format
 * invalide" qui, pour l'utilisateur, ne veut rien dire de plus qu'"réessaie".
 */
async function callClaudeJSON<T>(
  system: string,
  userText: string,
  maxTokens: number,
): Promise<T> {
  const deadline = aiDeadline();
  const startedAt = Date.now();
  let { text, stopReason } = await callClaudeRaw(
    system,
    userText,
    maxTokens,
    deadline,
  );
  if (stopReason === "max_tokens") {
    // La relance produit ~2x plus de texte, donc elle dure ~2x plus longtemps.
    // La lancer sans vérifier le temps restant, c'était la garantie de se
    // faire tuer par Vercel en plein milieu — et de rendre une page 504 brute
    // au lieu d'un message. On ne retente que si ça tient dans le budget.
    const firstCallMs = Date.now() - startedAt;
    if (firstCallMs * 2 < deadline - Date.now()) {
      ({ text, stopReason } = await callClaudeRaw(
        system,
        userText,
        Math.min(maxTokens * 2, 8000),
        deadline,
      ));
    }
    if (stopReason === "max_tokens") {
      throw new AiError(
        "too_long",
        "Ta demande est trop longue pour être traitée d'un coup. Raccourcis ton script (ou fais-en deux vidéos) et relance.",
      );
    }
  }
  const raw = extractJsonBlock(text);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AiError("parse", "L'IA a renvoyé un format invalide. Réessaie.");
  }
}

/* =========================================================================
   Génération de script — Gemini
   -------------------------------------------------------------------------
   Les trois générateurs de SCRIPT (Reel, Story, Vlog) passent par Gemini.
   Le reste des appels IA — découpage storyboard, autopsie, stratégie de
   marque, assistant de thèmes, analyse de vidéo de référence — reste sur
   Claude.

   Bascule : dès que GEMINI_API_KEY existe côté serveur, Gemini prend la main.
   Sans la clé, on retombe sur Claude. Le déploiement ne casse donc jamais,
   mais tant que la clé n'est pas dans Vercel c'est bien Claude qui répond.
   ========================================================================= */

export const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
/** Révision d'API épinglée : sans elle, le format de réponse peut changer sous nos pieds. */
export const GEMINI_API_REVISION = "2026-05-20";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";

/** Sous-ensemble de JSON Schema accepté par Gemini (ni $ref, ni additionalProperties). */
export type GeminiSchema = {
  type: "object" | "array" | "string" | "integer" | "number" | "boolean";
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  enum?: string[];
};

/** Vrai dès que la clé Gemini est configurée côté serveur. */
export function geminiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function callGeminiJSON<T>(
  system: string,
  userText: string,
  maxTokens: number,
  schema: GeminiSchema,
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "no_api_key",
      "L'IA n'est pas configurée. Ajoute GEMINI_API_KEY dans Vercel et redéploie.",
    );
  }

  const deadline = aiDeadline();
  let res: Response;
  try {
    res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "Api-Revision": GEMINI_API_REVISION,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        system_instruction: system,
        input: userText,
        generation_config: { max_output_tokens: maxTokens },
        // Le schéma est OBLIGATOIRE chez Gemini pour obtenir du JSON — et
        // c'est un gain : la structure est garantie par l'API au lieu d'être
        // seulement demandée dans le prompt.
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema,
        },
      }),
      signal: aiSignal(deadline),
    });
  } catch (e) {
    throw aiFetchError(e);
  }

  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403) {
      throw new AiError(
        "auth",
        "Clé Gemini refusée. Vérifie GEMINI_API_KEY dans Vercel.",
      );
    }
    if (status === 429) {
      throw new AiError(
        "rate_limit",
        "Quota Gemini atteint ou trop de requêtes. Réessaie dans une minute.",
      );
    }
    // Le 400 tombe ici volontairement : c'est presque toujours une requête
    // malformée (schéma refusé), et le message de Google est la seule piste
    // exploitable — le masquer derrière "clé invalide" ferait perdre du temps.
    let detail = "";
    try {
      const b = (await res.json()) as { error?: { message?: string } };
      detail = b?.error?.message ? ` : ${b.error.message}` : "";
    } catch {
      // ignore
    }
    throw new AiError("api", `Erreur Gemini (${status})${detail}.`);
  }

  const data = (await res.json()) as {
    status?: string;
    steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };

  // "incomplete" = coupé sur max_output_tokens. Le JSON est forcément
  // tronqué : autant le dire plutôt que d'échouer sur un parse.
  if (data.status === "incomplete") {
    throw new AiError(
      "too_long",
      "Ta demande est trop longue pour être traitée d'un coup. Raccourcis ton sujet et relance.",
    );
  }

  const text = (data.steps ?? [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();

  if (!text) throw new AiError("parse", "L'IA n'a rien renvoyé. Réessaie.");

  try {
    return JSON.parse(extractJsonBlock(text)) as T;
  } catch {
    throw new AiError("parse", "L'IA a renvoyé un format invalide. Réessaie.");
  }
}

/* ----------------------- Schémas de sortie (Gemini) ---------------------- */

const S_TEXT: GeminiSchema = { type: "string" };
const EQUIPMENT_POSITION_SCHEMA: GeminiSchema = {
  type: "string",
  enum: [
    "face",
    "avant_droite",
    "droite",
    "arriere_droite",
    "arriere",
    "arriere_gauche",
    "gauche",
    "avant_gauche",
  ],
};

/** Le schéma suit le prompt : les placements ne sont demandés que s'il y a
 *  des setups équipés, sinon Gemini les inventerait pour remplir le champ. */
function filmingGuideSchema(withPresetLayouts: boolean): GeminiSchema {
  const properties: Record<string, GeminiSchema> = {
    lighting: S_TEXT,
    camera_style: S_TEXT,
    pacing: S_TEXT,
    energy: S_TEXT,
    tip: S_TEXT,
    camera_position: EQUIPMENT_POSITION_SCHEMA,
  };
  if (withPresetLayouts) {
    properties.preset_layouts = {
      type: "array",
      items: {
        type: "object",
        properties: {
          preset_label: S_TEXT,
          equipment_layout: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: S_TEXT,
                position: EQUIPMENT_POSITION_SCHEMA,
                note: S_TEXT,
              },
              required: ["label", "position", "note"],
            },
          },
        },
        required: ["preset_label", "equipment_layout"],
      },
    };
  }
  return {
    type: "object",
    properties,
    required: ["lighting", "camera_style", "pacing", "energy", "tip"],
  };
}

function storyboardSchema(
  hasPresets: boolean,
  withPresetLayouts: boolean,
): GeminiSchema {
  const sceneProps: Record<string, GeminiSchema> = {
    description: S_TEXT,
    camera_angle: S_TEXT,
    expression: S_TEXT,
    movement: S_TEXT,
  };
  if (hasPresets) sceneProps.preset_label = S_TEXT;
  return {
    type: "object",
    properties: {
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: sceneProps,
          required: ["description", "camera_angle", "expression", "movement"],
        },
      },
      filming_guide: filmingGuideSchema(withPresetLayouts),
    },
    required: ["scenes", "filming_guide"],
  };
}

function reelSchema(
  includeStoryboard: boolean,
  hasPresets: boolean,
  withPresetLayouts: boolean,
): GeminiSchema {
  const properties: Record<string, GeminiSchema> = {
    accroche: S_TEXT,
    corps: S_TEXT,
    outro: S_TEXT,
  };
  const required = ["accroche", "corps", "outro"];
  if (includeStoryboard) {
    properties.storyboard = storyboardSchema(hasPresets, withPresetLayouts);
    required.push("storyboard");
  }
  return { type: "object", properties, required };
}

const STORY_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    objective: S_TEXT,
    cta_soft: S_TEXT,
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: { slot: { type: "integer" }, body: S_TEXT },
        required: ["slot", "body"],
      },
    },
  },
  required: ["objective", "cta_soft", "slides"],
};

const VLOG_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    angle: S_TEXT,
    hooks: { type: "array", items: S_TEXT },
    arc: {
      type: "object",
      properties: {
        situation: S_TEXT,
        development: S_TEXT,
        payoff: S_TEXT,
      },
      required: ["situation", "development", "payoff"],
    },
    captureShots: { type: "array", items: S_TEXT },
    voiceover: S_TEXT,
    caption: S_TEXT,
  },
  required: ["angle", "hooks", "arc", "captureShots", "voiceover", "caption"],
};

/* =========================================================================
   Génération — Vlog (API Claude)
   ========================================================================= */

export type VlogGeneration = {
  /** Le fil narratif en 1 phrase. */
  angle: string;
  /** 2-3 hooks d'ouverture distincts (l'user en choisit un). */
  hooks: string[];
  /** Arc en 3 temps : situation → développement → chute. */
  arc: { situation: string; development: string; payoff: string };
  /** 6-8 moments concrets à filmer, dans l'ordre de la journée. */
  captureShots: string[];
  /** Le script voix-off à lire par-dessus les clips. */
  voiceover: string;
  /** Légende du post + hashtags. */
  caption: string;
};

/**
 * Transforme un sujet en plan de vlog actionnable (angle, hooks, arc,
 * checklist de capture, voix-off, légende). Via Claude (pas OpenAI — la
 * carte de l'utilisatrice n'est acceptée que chez Anthropic), multilingue
 * FR + arabe.
 */
export function generateVlog(opts: {
  topic: string;
  audience?: string;
  platform?: string;
  /** Hashtags récurrents de la marque (issus de sa stratégie) — la légende
   *  les réutilise au lieu d'en réinventer à chaque contenu. */
  brandHashtags?: string[];
}): Promise<VlogGeneration> {
  const audience = opts.audience?.trim() || "audience curieuse sur les réseaux";
  const platform = opts.platform?.trim() || "Instagram / TikTok";
  const tags = (opts.brandHashtags ?? []).filter((h) => h.trim());
  const captionSpec = tags.length
    ? `La légende du post. Termine par ces hashtags RÉCURRENTS de la marque : ${tags
        .map((h) => `#${h}`)
        .join(" ")} — tu peux en ajouter 1 ou 2 spécifiques au sujet, pas plus.`
    : "La légende du post + 3 à 5 hashtags pertinents";

  const system = `Tu es un expert en VLOGS short-form (1 à 2 min) pour Instagram/TikTok, MULTILINGUE : français ET arabe. ${TUNISIAN_DIALECT_GUIDE} Un vlog ne se planifie PAS scène par scène : on part d'un ANGLE, on capture des MOMENTS pendant la journée, puis on POSE UNE VOIX-OFF par-dessus le montage. Ton job : transformer un sujet en plan de vlog directement actionnable.

RÈGLES :
- Écris dans la langue du sujet (français par défaut ; sujet en arabe → réponds en arabe).
- Ton direct, incarné, authentique — jamais corporate. Phrases courtes.
- Le HOOK (2 premières secondes) décide de tout : propose 3 hooks DISTINCTS et forts (tension, curiosité, ou promesse concrète). Pas de "Bonjour à tous".
- La CHECKLIST DE CAPTURE = les moments concrets à filmer pendant la journée, formulés comme des rappels courts et filmables ("Le café du matin en gros plan", "Ma réaction en ouvrant le colis"). 6 à 8 moments, dans l'ordre chronologique, qui racontent un début → milieu → fin.
- La VOIX-OFF = le texte à lire par-dessus les clips, dans l'ordre, qui lie les moments en une vraie histoire avec une chute. Tenable en 1-2 min.
- Réponds UNIQUEMENT avec un objet JSON valide : pas de backticks, pas de texte autour.`;

  const user = `Sujet du vlog : "${opts.topic}".
Plateforme : ${platform}
Audience : ${audience}
Durée cible : 1 à 2 minutes.

Renvoie UNIQUEMENT ce JSON (sans markdown autour) :
{
  "angle": "Le fil narratif en 1 phrase (ce qui rend ce vlog unique)",
  "hooks": ["Hook 1 (≤ 2s, percutant)", "Hook 2", "Hook 3"],
  "arc": {
    "situation": "Le point de départ / le contexte (1 phrase)",
    "development": "Ce qui se passe / la progression (1-2 phrases)",
    "payoff": "La chute / le message final qui donne du sens (1 phrase)"
  },
  "captureShots": ["Moment à filmer 1", "Moment à filmer 2", "… 6 à 8 au total, dans l'ordre de la journée"],
  "voiceover": "Le script voix-off complet, en paragraphes courts, dans l'ordre. 1 à 2 min.",
  "caption": "${captionSpec}"
}`;

  return geminiEnabled()
    ? callGeminiJSON<VlogGeneration>(system, user, 2000, VLOG_SCHEMA)
    : callClaudeJSON<VlogGeneration>(system, user, 2000);
}

/* =========================================================================
   Assistant de thèmes de contenu — conversationnel (API Claude)
   ========================================================================= */

export type ThemeProposal = {
  name: string;
  share_pct: number;
  objective: string;
  rubriques: string[];
  examples: string[];
  note: string;
};

export type ThemeAssistantReply = {
  /** Ce que l'assistant dit (question OU présentation des thèmes). */
  message: string;
  /** Thèmes proposés — null tant qu'il pose encore des questions. */
  themes: ThemeProposal[] | null;
};

/**
 * Un tour de l'assistant conversationnel qui aide un PATRON DE PETITE
 * ENTREPRISE (pas un expert) à définir ses THÈMES de contenu. Claude pose
 * 1-2 questions si besoin, puis propose 3-4 thèmes remplis (objectif +
 * rubriques + exemples) et les ajuste selon les retours. Répond toujours en
 * JSON {message, themes}. Tolérant : si la sortie n'est pas du JSON, on
 * renvoie le texte comme message (sans thèmes).
 */
export async function themeAssistantTurn(input: {
  brandName: string;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<ThemeAssistantReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "no_api_key",
      "L'IA n'est pas configurée. Ajoute ANTHROPIC_API_KEY dans Vercel et redéploie.",
    );
  }

  const system = `Tu es un stratège de contenu qui aide un PATRON DE PETITE ENTREPRISE (pas un expert marketing) à définir ses THÈMES de contenu vidéo pour les réseaux (Reels, TikTok, Stories). Multilingue : français ET arabe. ${TUNISIAN_DIALECT_GUIDE} Marque : "${input.brandName || "(sans nom)"}".

TON RÔLE, façon assistant interactif :
- Parle simplement, avec chaleur, zéro jargon. La personne ne sait PAS ce qu'est un "pilier" ni un "thème de contenu" — ne le lui demande jamais frontalement.
- Si tu n'as pas assez d'infos pour proposer de bons thèmes, pose 1 à 2 questions COURTES et concrètes (ex : "Tu fais quoi exactement ?", "C'est pour attirer de nouveaux clients ou rassurer les tiens ?"). Une étape à la fois, jamais un long questionnaire.
- Dès que tu as de quoi travailler, PROPOSE 3 à 4 thèmes remplis. Puis ajuste selon la personne (ajouter/retirer un thème, changer le ton, les %…).
- Chaque thème = un nom court avec un emoji au début + une part % (l'ensemble ≈ 100%) + un objectif en 1 phrase + 5 à 7 rubriques (formats récurrents courts) + 5 à 7 exemples de vidéos concrètes + une note (le pourquoi).

FORMAT — réponds TOUJOURS avec un SEUL objet JSON valide, rien autour :
{
  "message": "ce que tu dis à la personne, en langage simple (une question OU la présentation des thèmes)",
  "themes": null
}
Quand tu proposes/ajustes des thèmes, remplace null par un tableau :
"themes": [
  { "name": "🦶 Prévention & Conseils", "share_pct": 40, "objective": "…", "rubriques": ["…","…"], "examples": ["…","…"], "note": "…" }
]
Réponds dans la langue de la personne (français par défaut).`;

  const messages = input.history
    .filter((m) => m.content && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  if (!messages.some((m) => m.role === "user")) {
    messages.push({
      role: "user",
      content: "Aide-moi à définir mes thèmes de contenu.",
    });
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2200,
        system,
        messages,
      }),
      signal: aiSignal(aiDeadline()),
    });
  } catch (e) {
    throw aiFetchError(e);
  }

  if (!res.ok) {
    const status = res.status;
    if (status === 401) {
      throw new AiError("auth", "Clé Anthropic invalide. Vérifie ANTHROPIC_API_KEY.");
    }
    if (status === 429) {
      throw new AiError(
        "rate_limit",
        "Quota atteint ou trop de requêtes. Réessaie dans une minute.",
      );
    }
    throw new AiError("api", `Erreur Anthropic (${status}). Réessaie.`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new AiError("empty", "Réponse vide de l'IA.");

  const raw = extractJsonBlock(text);
  try {
    const parsed = JSON.parse(raw) as ThemeAssistantReply;
    return {
      message: typeof parsed.message === "string" ? parsed.message : text,
      themes: Array.isArray(parsed.themes) ? parsed.themes : null,
    };
  } catch {
    // Pas de JSON exploitable → on montre le texte tel quel, sans thèmes.
    return { message: text, themes: null };
  }
}

export type ReferenceAnalysisInput = {
  /** Transcript de la vidéo de référence (issu de la transcription Groq). */
  transcript: string;
  platform?: string | null;
  /** Contexte de la marque pour adapter le script proposé (optionnel). */
  brandContext?: string | null;
};

/**
 * Décortique le WORDING d'une vidéo de référence (ce qui marche / ce qui
 * l'affaiblit), en extrait la formule, et propose un NOUVEAU script
 * (Accroche / Corps / Outro) adapté à la marque de l'utilisatrice.
 *
 * Multilingue (FR + arabe/dialectes), ne refuse jamais, répond dans la
 * langue du transcript. N'a pas besoin de stats (contrairement à l'autopsie)
 * — analyse le wording sur ses mérites et signale sa confiance.
 */
export async function analyzeReferenceVideo(
  input: ReferenceAnalysisInput,
): Promise<string> {
  if (!input.transcript || input.transcript.trim().length < 10) {
    throw new AiError(
      "empty_transcript",
      "Transcript trop court pour analyser.",
    );
  }

  const system = `Tu es un analyste expert en contenu vidéo short-form (Reels, TikTok, Shorts), MULTILINGUE : français ET arabe, dialectes maghrébins inclus (tunisien, algérien, marocain) + arabe standard. Tu décortiques le WORDING d'une vidéo de référence pour en extraire la FORMULE qui marche, puis tu écris un NOUVEAU script inspiré, adapté à la marque de l'utilisatrice.

RÈGLES :
- Tu ne refuses JAMAIS d'analyser, quelle que soit la langue ou la qualité du transcript.
- RÉPONDS dans la langue du transcript (arabe → arabe ; français → français ; mélange/arabizi → langue dominante).
- Pour "TON SCRIPT" (le NOUVEAU script que tu écris, pas une citation du transcript) : si tu écris en arabe et que rien dans le transcript n'indique clairement un autre dialecte précis, ${TUNISIAN_DIALECT_GUIDE}
- Transcript imparfait (sous-titres auto, troués) : si l'intention est ambiguë, commence par 1 phrase "Voici ce que je comprends : ..." puis analyse sur cette base. N'analyse jamais du charabia au pied de la lettre.
- Cite TOUJOURS les phrases/expressions EXACTES entre guillemets. Jamais de généralité ("le hook est bon") — dis QUELLE phrase et POURQUOI.
- Tu n'as PAS les stats de cette vidéo : analyse le wording sur ses mérites intrinsèques (force du hook, tension, structure, rythme, clarté de la promesse). Signale-le dans la confiance.
- Promesse de TENSION (erreur, secret, chiffre, contre-pied) = forte ; promesse de PROCESSUS ("je vais vous montrer comment je fais X") = faible. Bannis les conseils évidents, vise l'insight non-évident.

FORMAT DE SORTIE (texte simple, PAS de markdown ## ni ** — garde les emojis ; TRADUIS les titres dans la langue de ta réponse) :

🔍 POURQUOI CETTE VIDÉO ACCROCHE
- [phrase/expression exacte] → le mécanisme qui capte

⚠️ CE QUI L'AFFAIBLIT
- [phrase exacte ou moment] → la faiblesse (si rien de notable, dis-le franchement)

🎯 LA FORMULE
- Le squelette réutilisable en 1 à 3 lignes (la structure qui fait que ça marche)

✨ TON SCRIPT (adapté à ta marque)
- Accroche : [phrase exacte, prête à dire]
- Corps : [le développement, dans l'ordre où le dire]
- Outro : [la fermeture + l'appel à l'action]

📊 CONFIANCE : [élevée / moyenne / faible] — 1 phrase (ex : "analyse du wording sans les stats de la vidéo")`;

  const user = `VIDÉO DE RÉFÉRENCE À ANALYSER

Plateforme : ${input.platform || "(non précisée)"}
${
  input.brandContext?.trim()
    ? `Marque de l'utilisatrice (pour adapter le script proposé) : ${input.brandContext.trim()}`
    : "Marque : (non précisée — propose un script générique mais directement actionnable)"
}

Transcript (ce qui est dit dans la vidéo) :
"""
${input.transcript.trim()}
"""

Décortique le wording et propose un nouveau script en suivant EXACTEMENT le format demandé.`;

  return callClaudeText(system, user, 2200);
}

/* =========================================================================
   Studio de marque — génération de stratégie (API Claude)
   ========================================================================= */

/**
 * Liste blanche : seules ces réponses partent dans le brief.
 *
 * Le flux actuel ne demande que `story` + `content_goal`, puis 3 relances
 * facultatives. Les clés plus bas viennent de l'ancien questionnaire en 10
 * étapes : elles sont conservées pour que les brouillons déjà saisis avant le
 * changement continuent de nourrir la génération au lieu d'être perdus.
 */
const STRATEGY_ANSWER_LABELS: Record<string, string> = {
  content_goal: "Objectif n°1 du contenu",
  // Relances facultatives — des FAITS, jamais inventés par l'IA.
  proof_result: "Résultat / preuve",
  legitimacy: "Ce qui la rend légitime",
  why_started: "Pourquoi elle a commencé",
  // Anciennes clés (rétrocompatibilité des brouillons).
  domain: "Domaine",
  problem_solved: "Problème résolu",
  where_online: "Présence en ligne",
  why_you: "Pourquoi la choisir",
  signature_method: "Méthode signature",
};

/**
 * Transforme les réponses du questionnaire du Studio de marque en stratégie :
 * positionnement, audience et voix reformulées, galères de l'audience,
 * méthode, messages clés. Volontairement SANS thèmes de contenu — ça reste
 * le rôle de l'assistant de thèmes existant, pour ne pas dupliquer la même
 * capacité à deux endroits. Pensé pour un PATRON DE PETITE ENTREPRISE : zéro
 * jargon, tout est directement réutilisable.
 */
export async function generateBrandStrategy(opts: {
  brandName: string;
  answers: Record<string, string>;
}): Promise<GeneratedStrategy> {
  // La 1re question est une phrase à trous (activité / qui / quoi) — on la
  // recompose en une ligne de brief lisible.
  const activity = (opts.answers["what_you_do__activity"] ?? "").trim();
  const who = (opts.answers["what_you_do__who"] ?? "").trim();
  const what = (opts.answers["what_you_do__what"] ?? "").trim();
  const whatYouDoLine =
    activity || who || what
      ? `Son activité : ${activity || "…"}. Elle aide ${who || "…"} à ${what || "…"}.`
      : null;

  const brief = [
    whatYouDoLine,
    ...Object.entries(STRATEGY_ANSWER_LABELS).map(([key, label]) => {
      const v = (opts.answers[key] ?? "").trim();
      return v ? `${label} : ${v}` : null;
    }),
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const system = `Tu es un stratège de marque qui aide un PATRON DE PETITE ENTREPRISE (pas un expert marketing) à transformer ses réponses en une STRATÉGIE DE CONTENU claire, prête à l'emploi. Multilingue : français ET arabe. ${TUNISIAN_DIALECT_GUIDE} Marque : "${opts.brandName || "(sans nom)"}".

Elle ne remplit PAS un long formulaire : elle complète une phrase en trois blancs (son activité, qui elle aide, à quoi). C'est VOLONTAIREMENT court. Ton travail est d'en DÉDUIRE le reste — son domaine, le profil précis de son audience, le problème qu'elle résout, ce qui la distingue — puis d'en faire une stratégie complète et concrète.

RÈGLES :
- Zéro jargon marketing. Écris comme si tu expliquais directement à la personne, avec chaleur et clarté.
- Base-toi UNIQUEMENT sur ce qu'elle a indiqué. Déduis largement ce qui l'est raisonnablement (un resto de quartier à La Marsa → clientèle locale, midi en semaine, budget maîtrisé) ; ne dis jamais "information manquante", ne repose jamais de question (ce n'est pas un dialogue).
- N'INVENTE JAMAIS DE FAITS la concernant : pas de chiffre de résultat, pas d'année d'expérience, pas de nombre de clients, pas de récompense, pas d'anecdote personnelle qu'elle n'a pas donnée. Ce sont des faits vérifiables — les inventer la mettrait en difficulté devant un vrai client. Si elle n'a pas fourni de preuve chiffrée, construis la confiance autrement (son approche, son attention, sa spécialisation) sans jamais chiffrer.
- Déduire un CONTEXTE plausible est attendu ; inventer un FAIT vérifiable ne l'est pas. La nuance : "sa clientèle vient surtout le midi" est une déduction ; "elle a 8 ans d'expérience" est une invention.
- "positioning" : 1-2 phrases qui résument QUI elle aide et EN QUOI elle est différente — la phrase qu'elle pourrait dire pour se présenter.
- "tagline" : une accroche courte et mémorable (5-8 mots).
- "audiences" : de 1 à 3 CIBLES distinctes. Beaucoup d'activités en ont plusieurs qui n'ont rien à voir (un restaurant : les familles le midi ET les entreprises pour leurs événements). N'en invente pas pour faire nombre : s'il n'y en a qu'une, tu n'en mets qu'une. Mets la principale EN PREMIER. Pour chacune : "name" (nom court et parlant, ex : « Les familles du quartier »), "who" (qui c'est, 1 phrase), "wants" (ce qu'elle cherche, 1 phrase), "pain_points" (exactement 3 galères concrètes DE CETTE CIBLE — ancrées dans le réel, pas des généralités).
- "voice_summary" : le ton à adopter, en 2 phrases MAXIMUM (ex : "tutoie", "un peu d'humour", "direct et rassurant").
- "approach" : 2-3 phrases qui expliquent CONCRÈTEMENT comment elle aide — sa méthode, sa façon de faire. Pas une liste de services : une explication simple, comme elle le dirait elle-même.
- "key_messages" : exactement 3 messages ou preuves à répéter dans son contenu pour construire la confiance.
- "hashtags" : 5 à 8 hashtags récurrents pour cette marque, déduits de son domaine, son audience et son positionnement. SANS le "#", en minuscules, sans accents ni espaces. Mélange large (son secteur) et précis (sa niche, sa ville si pertinent). Dans la langue de ses réponses.
- Ne propose PAS de thèmes/piliers de contenu (ce qu'il faut poster) — ce n'est pas le rôle de cette stratégie, une autre fonctionnalité de l'app s'en charge déjà.
- Reste concis partout — des phrases courtes, JAMAIS de paragraphe à rallonge. Cette stratégie s'affiche sur un écran, elle doit se lire d'un coup d'œil : si une section dépasse 3 phrases, c'est trop long. Le JSON complet doit rester compact.

Réponds UNIQUEMENT avec un objet JSON valide, rien autour, pas de markdown :
{
  "positioning": "...",
  "tagline": "...",
  "audiences": [
    { "name": "...", "who": "...", "wants": "...", "pain_points": ["...", "...", "..."] }
  ],
  "voice_summary": "...",
  "approach": "...",
  "key_messages": ["...", "...", "..."],
  "hashtags": ["...", "...", "...", "...", "..."]
}
Réponds dans la langue des réponses de la personne (français par défaut).`;

  const user = `Voici ce que la personne a répondu au questionnaire du Studio de marque :

${brief || "(aucune réponse fournie — propose une stratégie générique mais actionnable)"}

Génère sa stratégie de contenu en suivant exactement le format demandé.`;

  const generated = await callClaudeJSON<GeneratedStrategy>(system, user, 3200);

  // `audience_summary` et `pain_points` ne sont plus demandés au modèle — on
  // les dérive de la cible principale. Tout ce qui les affiche déjà (écran de
  // stratégie, PDF, kit de marque) continue de fonctionner sans modification,
  // y compris sur les stratégies générées avant les cibles multiples.
  const main = generated.audiences?.[0];
  return {
    ...generated,
    audience_summary:
      generated.audience_summary?.trim() ||
      (main ? `${main.who} ${main.wants}`.trim() : ""),
    pain_points:
      generated.pain_points?.length ? generated.pain_points : (main?.pain_points ?? []),
  };
}
