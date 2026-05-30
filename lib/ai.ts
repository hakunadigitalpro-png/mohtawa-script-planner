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
// Modèle configurable via env ANTHROPIC_MODEL. Défaut : l'alias "-latest"
// de Sonnet 3.5, qui se résout automatiquement vers la version courante
// disponible sur le compte (plus robuste qu'un ID daté qui peut 404 si le
// compte n'a pas cette version précise). Pour épingler un modèle précis
// (ex : claude-sonnet-4-...), définir ANTHROPIC_MODEL dans Vercel.
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

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
  retentionNotes?: string | null;
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

  const system = `Tu es un analyste expert en contenu vidéo short-form (Reels, TikTok, Shorts) spécialisé dans le marché francophone. Ton job : faire l'AUTOPSIE d'une vidéo pour comprendre POURQUOI elle performe ou échoue, au niveau du WORDING (ce qui est dit), pas de la technique de montage.

RÈGLES ABSOLUES :
- Cite TOUJOURS les phrases EXACTES de la vidéo entre guillemets. Jamais de généralité du type "ton hook est bon". Dis QUELLE phrase et POURQUOI.
- Bannis les conseils évidents que tout créateur connaît déjà. Donne des insights NON-ÉVIDENTS.
- Croise le WORDING avec les STATS. Une phrase n'est "bonne" que si une stat le suggère.
- Sois honnête : si une donnée manque pour conclure, dis-le. Ne devine pas.
- Écris en français, ton direct et concret.

FORMAT DE SORTIE (texte simple, PAS de markdown ## ni ** — utilise les emojis de section ci-dessous tels quels) :

✅ CE QUI A MARCHÉ
- [phrase exacte citée] → pourquoi, avec la stat qui le suggère

❌ CE QUI A COÛTÉ DES VUES
- [phrase exacte] → où/pourquoi tu penses que les gens décrochent

🎯 LA RÈGLE À RETENIR
- 1 seule règle actionnable pour TOUTES tes prochaines vidéos

✨ TA PROCHAINE VIDÉO
- Hook (phrase exacte) + angle + structure en 3 points qui réutilise le pattern gagnant, sur un sujet proche`;

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

  const user = `VIDÉO À ANALYSER

Titre : ${input.title || "(sans titre)"}
Plateforme : ${input.platform || "(non précisée)"}
Stats : ${statsLines || "(aucune stat fournie)"}
${
  input.retentionNotes?.trim()
    ? `Courbe de rétention : ${input.retentionNotes.trim()}`
    : ""
}

Transcript (ce qui est dit dans la vidéo) :
"""
${input.transcript.trim()}
"""

Fais l'autopsie de cette vidéo en suivant exactement le format demandé.`;

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
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: user }],
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
