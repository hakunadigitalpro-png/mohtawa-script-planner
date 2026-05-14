/**
 * Petit wrapper autour de l'API OpenAI Chat Completions, pour générer
 * du contenu structuré (JSON) côté serveur. On reste minimal — pas de SDK,
 * juste fetch — pour ne pas alourdir le bundle Vercel.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

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
