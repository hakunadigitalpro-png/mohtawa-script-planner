/**
 * Petit wrapper autour de l'API OpenAI Chat Completions, pour générer
 * du contenu structuré (JSON) côté serveur. On reste minimal — pas de SDK,
 * juste fetch — pour ne pas alourdir le bundle Vercel.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const MODEL = "gpt-4o-mini";
const IMAGE_MODEL = "dall-e-3";

// ===== Anthropic (Claude) — utilisé pour l'autopsie vidéo (feature premium) =====
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Modèle configurable via env ANTHROPIC_MODEL. Défaut : Sonnet 4.6
// (même prix que 4.5 — 3$/15$ par 1M — mais meilleure qualité ; bon
// équilibre pour l'autopsie ET l'analyse de transcript). Pour Haiku
// (moins cher) ou Opus (plus puissant), définir ANTHROPIC_MODEL dans Vercel.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// ===== Groq — transcription audio (Whisper), gratuit sans carte =====
// Claude ne transcrit PAS l'audio. On délègue la transcription à Groq
// (API compatible OpenAI), qui fait tourner Whisper large v3 turbo très
// vite et gratuitement (tier sans carte). La clé GROQ_API_KEY se crée sur
// console.groq.com sans moyen de paiement.
const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class AiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AiError";
  }
}

export async function generateJSON<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "no_api_key",
      "L'IA n'est pas configurée. Ajoute OPENAI_API_KEY dans Vercel et redéploie.",
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.8,
        max_tokens: opts.maxTokens ?? 800,
        response_format: { type: "json_object" },
      }),
    });
  } catch {
    throw new AiError("network", "Impossible de joindre l'IA. Réessaie.");
  }

  if (!res.ok) {
    const status = res.status;
    if (status === 401) {
      throw new AiError("auth", "Clé OpenAI invalide. Vérifie OPENAI_API_KEY.");
    }
    if (status === 429) {
      throw new AiError(
        "rate_limit",
        "Trop de requêtes ou quota atteint. Réessaie dans une minute.",
      );
    }
    throw new AiError("api", `Erreur OpenAI (${status}). Réessaie.`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new AiError("empty", "Réponse vide de l'IA.");

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AiError("parse", "L'IA a renvoyé un format invalide. Réessaie.");
  }
}

/* =========================================================================
   Prompts — Reel
   ========================================================================= */

export type ReelGeneration = {
  hook: string;
  intro: string;
  point1: string;
  point2: string;
  point3: string;
  transition: string;
  recap: string;
  cta: string;
  outro: string;
};

export function generateReel(opts: {
  topic: string;
  audience?: string;
  platform?: string;
}): Promise<ReelGeneration> {
  const system =
    "Tu es un expert en contenu vidéo viral pour les réseaux sociaux. Tu écris en français, dans un ton direct, percutant et orienté valeur. Tu génères des scripts courts qui arrêtent le scroll. Pas de jargon. Phrases courtes. Une idée par phrase.";

  const audience = opts.audience?.trim() || "créateurs de contenu et entrepreneurs";
  const platform = opts.platform?.trim() || "Instagram / TikTok";

  const user = `Génère un script de Reel sur le sujet : "${opts.topic}".

Plateforme : ${platform}
Audience cible : ${audience}

Le script doit faire 30 à 60 secondes lus à voix haute. Phrases courtes, idées fortes, valeur immédiate.

Retourne UNIQUEMENT un JSON valide (sans backticks, sans markdown) avec cette structure exacte :
{
  "hook": "Phrase d'accroche qui arrête le scroll (5-12 mots)",
  "intro": "Pose le contexte ou la promesse en 1 phrase",
  "point1": "Premier point clé (1-2 phrases)",
  "point2": "Deuxième point clé (1-2 phrases)",
  "point3": "Troisième point clé (1-2 phrases)",
  "transition": "Indication B-roll ou plan visuel court",
  "recap": "Résumé percutant en 1 phrase",
  "cta": "Call to action clair et simple",
  "outro": "Phrase de fermeture mémorable"
}`;

  return generateJSON<ReelGeneration>({ system, user, maxTokens: 800 });
}

/* =========================================================================
   Image generation — DALL-E 3
   ========================================================================= */

export type SceneImageOpts = {
  description: string;
  cameraAngle?: string;
  onScreenText?: string;
};

export type SceneImageResult = {
  /** URL temporaire OpenAI (valide ~60min). À DL + uploader sur Supabase Storage. */
  url: string;
  /** Prompt révisé par DALL-E (utile pour debug / régénération guidée). */
  revisedPrompt: string;
};

/**
 * Construit un prompt DALL-E 3 à partir des champs d'une scène storyboard.
 * Style cinématique propre, 16:9, pas de watermarks ni de marques réelles.
 */
function buildScenePrompt(opts: SceneImageOpts): string {
  const parts: string[] = [
    "A storyboard frame illustration for a short-form social media video (Reel / TikTok).",
    "Style: clean, modern, illustrative storyboard look. Soft natural lighting. Cinematic 16:9 framing. Hand-drawn-meets-vector aesthetic.",
    "",
    `Scene action: ${opts.description.trim()}.`,
  ];

  if (opts.cameraAngle?.trim()) {
    parts.push(`Camera angle / shot type: ${opts.cameraAngle.trim()}.`);
  }

  if (opts.onScreenText?.trim()) {
    parts.push(
      `On-screen text overlay (visible inside the frame as caption): "${opts.onScreenText.trim()}".`,
    );
  }

  parts.push(
    "",
    "Important constraints: No watermarks. No logos. No real brand names. No real recognizable people. Focus on illustrating the composition and the action — this is a pre-visualization for filming, not a final asset.",
  );

  return parts.join("\n");
}

/**
 * Appelle DALL-E 3 et renvoie l'URL temporaire de l'image générée.
 * Coût ~0.080$ par image en 1792x1024 standard quality.
 */
export async function generateSceneImage(
  opts: SceneImageOpts,
): Promise<SceneImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "no_api_key",
      "L'IA n'est pas configurée. Ajoute OPENAI_API_KEY dans Vercel et redéploie.",
    );
  }

  const prompt = buildScenePrompt(opts);

  let res: Response;
  try {
    res = await fetch(OPENAI_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        // 1792x1024 = 16:9 landscape, parfait pour storyboard (aspect-video)
        size: "1792x1024",
        // "standard" suffit largement pour une preview de scène ($0.08 vs $0.12 hd)
        quality: "standard",
        n: 1,
      }),
    });
  } catch {
    throw new AiError("network", "Impossible de joindre l'IA. Réessaie.");
  }

  if (!res.ok) {
    const status = res.status;
    type ErrorBody = { error?: { code?: string; message?: string } };
    let body: ErrorBody | null = null;
    try {
      body = (await res.json()) as ErrorBody;
    } catch {
      // body unreadable
    }
    if (status === 401) {
      throw new AiError("auth", "Clé OpenAI invalide. Vérifie OPENAI_API_KEY.");
    }
    if (status === 429) {
      throw new AiError(
        "rate_limit",
        "Trop de requêtes ou quota OpenAI atteint. Réessaie dans une minute.",
      );
    }
    if (status === 400 && body?.error?.code === "content_policy_violation") {
      throw new AiError(
        "content_policy",
        "Ta description a été refusée par les filtres OpenAI. Reformule en évitant les contenus sensibles, marques, ou personnes nommées.",
      );
    }
    throw new AiError(
      "api",
      `Erreur OpenAI (${status})${body?.error?.message ? ` : ${body.error.message}` : ""}.`,
    );
  }

  const data = (await res.json()) as {
    data?: { url?: string; revised_prompt?: string }[];
  };
  const first = data.data?.[0];
  if (!first?.url) throw new AiError("empty", "Réponse vide de DALL-E.");

  return {
    url: first.url,
    revisedPrompt: first.revised_prompt ?? prompt,
  };
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
}): Promise<StoryGeneration> {
  const system =
    "Tu es un expert en stories Instagram/TikTok. Tu écris en français, dans un ton authentique, engageant et conversationnel. Tu crées des séquences de 5 stories qui retiennent l'attention jusqu'au CTA.";

  const audience = opts.audience?.trim() || "audience curieuse et engagée";

  const user = `Génère une séquence de 5 stories sur le sujet : "${opts.topic}".

Audience cible : ${audience}

Structure obligatoire :
- Story 1 : Hook visuel + promesse ou question
- Story 2 : Mise en contexte / révélation
- Story 3 : Le contenu de valeur / exemple
- Story 4 : Conseil clé ou ressource
- Story 5 : Call to action (sticker, swipe up, DM...)

Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "objective": "Objectif global de la séquence en 1 phrase",
  "cta_soft": "Action douce souhaitée (sticker question, DM, etc.)",
  "slides": [
    { "slot": 1, "body": "Texte de la story 1 (court, percutant)" },
    { "slot": 2, "body": "Texte de la story 2" },
    { "slot": 3, "body": "Texte de la story 3" },
    { "slot": 4, "body": "Texte de la story 4" },
    { "slot": 5, "body": "Texte de la story 5 (avec call to action)" }
  ]
}`;

  return generateJSON<StoryGeneration>({ system, user, maxTokens: 800 });
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
    });
  } catch {
    throw new AiError("network", "Impossible de joindre l'IA. Réessaie.");
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
async function callClaudeText(
  system: string,
  userText: string,
  maxTokens: number,
): Promise<string> {
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
    });
  } catch {
    throw new AiError("network", "Impossible de joindre l'IA. Réessaie.");
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
  };
  const text = data.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new AiError("empty", "Réponse vide de l'IA.");
  return text;
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
