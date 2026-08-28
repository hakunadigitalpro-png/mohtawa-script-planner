import { AiError, ANTHROPIC_URL, aiFetchError, aiSignal } from "./ai";

/* =========================================================================
   Krea copilote — la couche « appel modèle avec outils »
   -------------------------------------------------------------------------
   Krea tourne sur CLAUDE, comme le reste de la plateforme. Gemini est
   réservé à l'écriture des scripts (règle posée par l'utilisatrice) — et
   quand Krea déclenche l'outil `rediger_script`, c'est bien Gemini qui rédige
   derrière, via les générateurs existants.

   Elle ne se contente pas de répondre : elle AGIT. C'est du tool use — le
   modèle décide quel outil appeler, on l'exécute côté serveur, on lui rend le
   résultat, il rédige sa réponse.
   ========================================================================= */

/**
 * Modèle de Krea : Haiku, volontairement plus léger que le reste de l'app.
 * Krea répond à CHAQUE message du chat, là où un générateur de script tourne
 * quelques fois par jour — c'est le seul appel dont le volume justifie un
 * modèle dédié. Son travail (comprendre une demande courte, choisir un outil,
 * répondre en deux phrases) n'a pas besoin de plus.
 * Les générations de fond gardent ANTHROPIC_MODEL, elles n'y touchent pas.
 */
const KREA_MODEL = process.env.KREA_MODEL || "claude-haiku-4-5";

export type KreaTool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type KreaFunctionCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

/** Un tour de conversation tel qu'on le garde côté client, sans la plomberie. */
export type KreaTurn = { role: "user" | "assistant"; content: string };

/** Un point de cache peut se poser sur n'importe quel bloc de contenu. */
type Cacheable = { cache_control?: { type: "ephemeral" } };

type ContentBlock =
  | ({ type: "text"; text: string } & Cacheable)
  | ({
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    } & Cacheable)
  | ({ type: "tool_result"; tool_use_id: string; content: string } & Cacheable);

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

export type KreaReply = {
  text: string;
  calls: KreaFunctionCall[];
  /** Le tour de l'assistant tel quel — à réinjecter avant les résultats d'outils. */
  assistantContent: ContentBlock[];
  truncated: boolean;
};

/**
 * Marque le dernier bloc du fil comme point de cache. Le prochain appel de la
 * boucle repart de ce préfixe : il est alors lu depuis le cache (~10 % du
 * prix) au lieu d'être renvoyé au tarif plein.
 */
function withTailBreakpoint(messages: ClaudeMessage[]): ClaudeMessage[] {
  if (!messages.length) return messages;
  const out = messages.slice();
  const last = out[out.length - 1];
  const blocks: ContentBlock[] =
    typeof last.content === "string"
      ? [{ type: "text", text: last.content }]
      : last.content.slice();
  if (!blocks.length) return messages;
  blocks[blocks.length - 1] = {
    ...blocks[blocks.length - 1],
    cache_control: { type: "ephemeral" },
  };
  out[out.length - 1] = { ...last, content: blocks };
  return out;
}

export async function kreaInteract(opts: {
  /** Persona + règles : figé, donc mis en cache. */
  systemStable: string;
  /** Contexte vivant (marque, page, thèmes) : change souvent, jamais mis en cache. */
  systemContext: string;
  messages: ClaudeMessage[];
  tools: KreaTool[];
  deadline: number;
  maxTokens?: number;
  /**
   * Pose un second point de cache sur la fin du fil. Utile dans la boucle
   * d'outils : le tour suivant renvoie tout ce qui précède, qui devient alors
   * un préfixe déjà en cache au lieu d'être refacturé plein tarif.
   */
  cacheTail?: boolean;
}): Promise<KreaReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "no_api_key",
      "Krea n'est pas branchée. Ajoute ANTHROPIC_API_KEY dans Vercel et redéploie.",
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
        model: KREA_MODEL,
        max_tokens: opts.maxTokens ?? 1200,
        // Deux blocs système, dans cet ordre : le figé d'abord avec le point
        // de cache, le vivant après. L'API met en cache par PRÉFIXE — mettre
        // le contexte avant invaliderait le cache à chaque changement de page.
        system: [
          {
            type: "text",
            text: opts.systemStable,
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: opts.systemContext },
        ],
        tools: opts.tools,
        messages: opts.cacheTail
          ? withTailBreakpoint(opts.messages)
          : opts.messages,
      }),
      signal: aiSignal(opts.deadline),
    });
  } catch (e) {
    throw aiFetchError(e);
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new AiError("auth", "Clé Anthropic invalide. Vérifie ANTHROPIC_API_KEY.");
    }
    if (res.status === 429) {
      throw new AiError(
        "rate_limit",
        "Krea est très sollicitée là. Réessaie dans une minute.",
      );
    }
    let detail = "";
    try {
      const b = (await res.json()) as { error?: { message?: string } };
      detail = b?.error?.message ? ` : ${b.error.message}` : "";
    } catch {
      // ignore
    }
    throw new AiError("api", `Erreur Anthropic (${res.status})${detail}.`);
  }

  const data = (await res.json()) as {
    content?: ContentBlock[];
    stop_reason?: string | null;
  };

  const content = data.content ?? [];
  const text = content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const calls = content
    .filter(
      (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        b.type === "tool_use",
    )
    .map((b) => ({ id: b.id, name: b.name, input: b.input ?? {} }));

  return {
    text,
    calls,
    assistantContent: content,
    truncated: data.stop_reason === "max_tokens",
  };
}

/* ------------------------------- Les outils ------------------------------ */

/**
 * Volontairement court. Krea ne peut RIEN supprimer ni écraser : elle crée,
 * elle rédige, elle navigue. Une copilote qui efface par erreur, on ne lui
 * fait plus jamais confiance — et la confiance est tout l'intérêt.
 */
export const KREA_TOOLS: KreaTool[] = [
  {
    name: "creer_contenu",
    description:
      "Crée un nouveau contenu dans le planning de la marque active. N'appelle cet outil QUE si tu connais le type ET un titre concret — sinon pose la question d'abord.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["reel", "story", "vlog", "post", "carousel", "infographic"],
          description: "Le format du contenu.",
        },
        titre: {
          type: "string",
          description: "Titre court et concret, dans la langue de l'utilisatrice.",
        },
        date: {
          type: "string",
          description: "Date de publication au format AAAA-MM-JJ, si elle est connue.",
        },
        plateforme: {
          type: "string",
          enum: ["instagram", "tiktok", "youtube", "facebook", "linkedin"],
          description: "Plateforme de publication, si elle est connue.",
        },
        theme: {
          type: "string",
          description:
            "Nom EXACT d'un thème de contenu de la marque, repris de la liste du contexte. N'invente jamais un thème.",
        },
      },
      required: ["type", "titre"],
    },
  },
  {
    name: "rediger_script",
    description:
      "Écrit le script d'un contenu reel, story ou vlog déjà créé, et l'enregistre. Utilise l'identifiant renvoyé par creer_contenu, ou celui du contenu ouvert indiqué dans le contexte.",
    input_schema: {
      type: "object",
      properties: {
        content_id: {
          type: "string",
          description: "Identifiant du contenu à remplir.",
        },
        sujet: {
          type: "string",
          description:
            "De quoi parle le contenu, en une phrase. Sert de brief au générateur.",
        },
      },
      required: ["content_id", "sujet"],
    },
  },
  {
    name: "ouvrir_page",
    description:
      "Emmène l'utilisatrice sur une page de l'application. Utile quand elle cherche où faire quelque chose.",
    input_schema: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: [
            "dashboard",
            "calendrier",
            "marque",
            "taches",
            "analytics",
            "accroches",
          ],
          description: "La page à ouvrir.",
        },
      },
      required: ["page"],
    },
  },
];

/* ----------------------------- Le personnage ----------------------------- */

export type KreaContext = {
  brandName: string | null;
  brandId: string | null;
  /** Page où se trouve l'utilisatrice, en clair. */
  page: string;
  /** Contenu ouvert, si on est sur une fiche. */
  openContent?: { id: string; title: string; type: string } | null;
  hasStrategy: boolean;
  themes: string[];
  setups: string[];
  contentCount: number;
  today: string;
};

/** Figé d'un tour à l'autre → c'est ce bloc qui est mis en cache. */
export const KREA_PERSONA = `Tu es Krea, la coach de Kreatly. Tu accompagnes un PATRON DE PETITE ENTREPRISE qui n'est pas marketeur et qui, souvent, ne sait pas par où commencer.

TON :
- Chaleureuse, encourageante, directe. Tu tutoies.
- ZÉRO jargon. Jamais "pilier éditorial", "funnel", "KPI", "persona".
- Tu dis "contenus", pas "vidéos" — la plateforme gère aussi des posts et des carrousels.
- Réponses COURTES : 1 à 3 phrases. On est dans un chat, pas dans un article.

TA FAÇON DE TRAVAILLER :
- Tu AGIS au lieu d'expliquer comment faire. Si elle dit "je veux faire un reel", tu ne décris pas les étapes : tu crées le reel.
- S'il te manque une information pour agir, tu poses UNE seule question, courte et concrète. Jamais deux questions d'affilée, jamais un questionnaire.
- Quand une information est devinable, tu la devines au lieu de la demander. Pas de date donnée ? Tu crées sans date, elle la posera plus tard.
- Après avoir agi, tu dis en une phrase ce que tu as fait et tu proposes la suite la plus utile.
- Tu ne promets jamais une action que tu n'as pas réellement faite avec un outil.

CE QUE TU NE PEUX PAS FAIRE : supprimer quoi que ce soit, modifier un contenu déjà rempli, publier sur les réseaux. Si on te le demande, dis-le simplement et indique où le faire à la main.`;

/** Change à chaque page / chaque marque → placé APRÈS le point de cache. */
export function kreaContextPrompt(ctx: KreaContext): string {
  return `CONTEXTE ACTUEL :
- Date du jour : ${ctx.today}
- Marque active : ${ctx.brandName ?? "aucune"}
- Page où elle se trouve : ${ctx.page}
${ctx.openContent ? `- Contenu ouvert : "${ctx.openContent.title}" (${ctx.openContent.type}), identifiant ${ctx.openContent.id}` : ""}
- Stratégie de contenu : ${ctx.hasStrategy ? "définie" : "pas encore faite"}
- Thèmes de contenu : ${ctx.themes.length ? ctx.themes.join(", ") : "aucun"}
- Setups de tournage : ${ctx.setups.length ? ctx.setups.join(", ") : "aucun"}
- Contenus déjà planifiés : ${ctx.contentCount}

Sers-toi de ce contexte pour éviter les questions dont tu connais déjà la réponse.`;
}
