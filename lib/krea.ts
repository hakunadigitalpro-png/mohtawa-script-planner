import {
  AiError,
  GEMINI_API_REVISION,
  GEMINI_MODEL,
  GEMINI_URL,
  aiFetchError,
  aiSignal,
} from "./ai";

/* =========================================================================
   Krea copilote — la couche « appel modèle avec outils »
   -------------------------------------------------------------------------
   Krea ne se contente pas de répondre : elle AGIT (créer un contenu, écrire
   un script, ouvrir une page). C'est du function calling — le modèle décide
   quel outil appeler, on l'exécute côté serveur, on lui rend le résultat, il
   rédige sa réponse.

   Économie de tokens : l'historique de la conversation reste chez Google et
   on ne renvoie que `previous_interaction_id` + le nouveau message. On ne
   repaie donc jamais tout le fil à chaque tour.
   ========================================================================= */

export type KreaTool = {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type KreaFunctionCall = {
  name: string;
  id: string;
  arguments: Record<string, unknown>;
};

export type KreaReply = {
  /** À renvoyer au tour suivant pour garder le fil sans repayer l'historique. */
  interactionId: string | null;
  text: string;
  calls: KreaFunctionCall[];
  /** Vrai si la réponse a été coupée sur la limite de tokens. */
  truncated: boolean;
};

export type KreaFunctionResult = {
  type: "function_result";
  name: string;
  call_id: string;
  result: { type: "text"; text: string }[];
};

/** Un tour d'appel : soit un message de l'utilisatrice, soit des résultats d'outils. */
export type KreaInput = string | KreaFunctionResult[];

export async function kreaInteract(opts: {
  system: string;
  input: KreaInput;
  previousInteractionId?: string | null;
  tools: KreaTool[];
  deadline: number;
  maxTokens?: number;
}): Promise<KreaReply> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "no_api_key",
      "Krea n'est pas encore branchée. Ajoute GEMINI_API_KEY dans Vercel et redéploie.",
    );
  }

  const body: Record<string, unknown> = {
    model: GEMINI_MODEL,
    system_instruction: opts.system,
    input: opts.input,
    tools: opts.tools,
    generation_config: { max_output_tokens: opts.maxTokens ?? 1200 },
  };
  if (opts.previousInteractionId) {
    body.previous_interaction_id = opts.previousInteractionId;
  }

  let res: Response;
  try {
    res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "Api-Revision": GEMINI_API_REVISION,
      },
      body: JSON.stringify(body),
      signal: aiSignal(opts.deadline),
    });
  } catch (e) {
    throw aiFetchError(e);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new AiError("auth", "Clé Gemini refusée. Vérifie GEMINI_API_KEY.");
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
    throw new AiError("api", `Erreur Gemini (${res.status})${detail}.`);
  }

  const data = (await res.json()) as {
    id?: string;
    status?: string;
    steps?: {
      type?: string;
      name?: string;
      id?: string;
      arguments?: Record<string, unknown>;
      content?: { type?: string; text?: string }[];
    }[];
  };

  const steps = data.steps ?? [];
  const text = steps
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();

  const calls: KreaFunctionCall[] = steps
    .filter((s) => s.type === "function_call" && s.name && s.id)
    .map((s) => ({
      name: s.name as string,
      id: s.id as string,
      arguments: s.arguments ?? {},
    }));

  return {
    interactionId: data.id ?? null,
    text,
    calls,
    truncated: data.status === "incomplete",
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
    type: "function",
    name: "creer_contenu",
    description:
      "Crée un nouveau contenu dans le planning de la marque active. N'appelle cet outil QUE si tu connais le type ET un titre concret — sinon pose la question d'abord.",
    parameters: {
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
            "Nom EXACT d'un thème de contenu de la marque, repris de la liste fournie dans le contexte. N'invente jamais un thème.",
        },
      },
      required: ["type", "titre"],
    },
  },
  {
    type: "function",
    name: "rediger_script",
    description:
      "Écrit le script d'un contenu reel, story ou vlog déjà créé, et l'enregistre. Utilise l'identifiant renvoyé par creer_contenu, ou celui du contenu ouvert indiqué dans le contexte.",
    parameters: {
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
    type: "function",
    name: "ouvrir_page",
    description:
      "Emmène l'utilisatrice sur une page de l'application. Utile quand elle cherche où faire quelque chose.",
    parameters: {
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

export function kreaSystemPrompt(ctx: KreaContext): string {
  return `Tu es Krea, la coach de Kreatly. Tu accompagnes un PATRON DE PETITE ENTREPRISE qui n'est pas marketeur et qui, souvent, ne sait pas par où commencer.

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

CE QUE TU NE PEUX PAS FAIRE : supprimer quoi que ce soit, modifier un contenu déjà rempli, publier sur les réseaux. Si on te le demande, dis-le simplement et indique où le faire à la main.

CONTEXTE ACTUEL :
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
