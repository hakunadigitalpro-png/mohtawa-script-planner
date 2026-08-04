import "server-only";

/**
 * Wrappers minimalistes (fetch, pas de SDK) autour des API IA utilisées côté
 * serveur : Claude (Anthropic) pour la génération de texte, Groq (Whisper) pour
 * la transcription. Reste léger pour ne pas alourdir le bundle Vercel.
 */

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

export class AiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AiError";
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
export type ReelGeneration = {
  accroche: string;
  corps: string;
  outro: string;
};

export function generateReel(opts: {
  topic: string;
  audience?: string;
  platform?: string;
}): Promise<ReelGeneration> {
  const audience =
    opts.audience?.trim() || "des clients potentiels sur les réseaux";
  const platform = opts.platform?.trim() || "Instagram / TikTok";

  const system = `Tu es un expert en scripts de Reels/TikTok qui arrêtent le scroll, MULTILINGUE : français ET arabe (dialectes maghrébins inclus). Tu écris pour un PATRON DE PETITE ENTREPRISE (pas un expert marketing) : simple, direct, humain, orienté valeur, ZÉRO jargon. Un script se dit à voix haute en 30-60 secondes, phrases courtes, une idée par phrase.

Structure en 3 parties SEULEMENT :
- Accroche : les 2 premières secondes qui stoppent le scroll (tension, curiosité ou promesse concrète).
- Corps : le développement, dans l'ordre où le dire.
- Outro : la fermeture + un appel à l'action clair.

Écris dans la langue du sujet (français par défaut). Réponds UNIQUEMENT avec un objet JSON valide, rien autour.`;

  const user = `Sujet de la vidéo : "${opts.topic}".
Plateforme : ${platform}
Audience : ${audience}

Renvoie UNIQUEMENT ce JSON (sans markdown) :
{
  "accroche": "La phrase d'accroche qui arrête le scroll (1 phrase forte, ≤ 2s)",
  "corps": "Le cœur du script : développe l'idée en phrases courtes, dans l'ordre où la dire. 30-45s.",
  "outro": "La fermeture + un appel à l'action clair (sauvegarde, commente, DM…)"
}`;

  return callClaudeJSON<ReelGeneration>(system, user, 1500);
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
  const audience = opts.audience?.trim() || "ton audience sur les réseaux";

  const system = `Tu es un expert en Stories Instagram/TikTok, MULTILINGUE : français ET arabe (dialectes maghrébins inclus). Tu écris pour un PATRON DE PETITE ENTREPRISE (pas un expert) : ton simple, authentique, conversationnel, ZÉRO jargon. Tu crées une séquence de 5 stories qui tiennent en haleine jusqu'au CTA. Écris dans la langue du sujet (français par défaut). Réponds UNIQUEMENT avec un objet JSON valide, rien autour.`;

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

  return callClaudeJSON<StoryGeneration>(system, user, 1500);
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

/**
 * Comme callClaudeText mais force une sortie JSON. Claude n'a pas de mode
 * "json_object" natif (contrairement à OpenAI) → on demande du JSON pur dans
 * le prompt, puis on extrait défensivement : on retire un éventuel bloc
 * ```json … ```, sinon on prend du premier "{" au dernier "}".
 */
async function callClaudeJSON<T>(
  system: string,
  userText: string,
  maxTokens: number,
): Promise<T> {
  const text = await callClaudeText(system, userText, maxTokens);
  let raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    raw = fenced[1].trim();
  } else {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      raw = raw.slice(start, end + 1);
    }
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AiError("parse", "L'IA a renvoyé un format invalide. Réessaie.");
  }
}

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
}): Promise<VlogGeneration> {
  const audience = opts.audience?.trim() || "audience curieuse sur les réseaux";
  const platform = opts.platform?.trim() || "Instagram / TikTok";

  const system = `Tu es un expert en VLOGS short-form (1 à 2 min) pour Instagram/TikTok, MULTILINGUE : français ET arabe (dialectes maghrébins inclus). Un vlog ne se planifie PAS scène par scène : on part d'un ANGLE, on capture des MOMENTS pendant la journée, puis on POSE UNE VOIX-OFF par-dessus le montage. Ton job : transformer un sujet en plan de vlog directement actionnable.

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
  "caption": "La légende du post + 3 à 5 hashtags pertinents"
}`;

  return callClaudeJSON<VlogGeneration>(system, user, 2000);
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

  const system = `Tu es un stratège de contenu qui aide un PATRON DE PETITE ENTREPRISE (pas un expert marketing) à définir ses THÈMES de contenu vidéo pour les réseaux (Reels, TikTok, Stories). Multilingue : français ET arabe (dialectes maghrébins inclus). Marque : "${input.brandName || "(sans nom)"}".

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
    });
  } catch {
    throw new AiError("network", "Impossible de joindre l'IA. Réessaie.");
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

  // Extraction JSON tolérante (fence ```json``` ou du premier { au dernier }).
  let raw = text;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    raw = fenced[1].trim();
  } else {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s !== -1 && e !== -1 && e > s) raw = raw.slice(s, e + 1);
  }
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
