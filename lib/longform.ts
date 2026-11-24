/* =========================================================================
   Les formats longs — vidéo longue, direct, podcast, article
   -------------------------------------------------------------------------
   Un seul éditeur en parties, réglé ici par format. Logique pure, testée :
   ni base, ni IA, ni React.
   ========================================================================= */

export type LongformType = "long_video" | "livestream" | "podcast" | "article";

export type LongformSpec = {
  /** Le nom de l'onglet d'écriture. */
  tab: string;
  /** Comment on appelle UNE partie. */
  part: string;
  addLabel: string;
  /** L'explication sous le titre de la carte. */
  hint: string;
  titlePlaceholder: string;
  bodyPlaceholder: string;
  /** Carte « Invité » et minutes prévues par partie. */
  hasGuest: boolean;
  hasMinutes: boolean;
  /** Ce que dit l'onglet Présentation : l'image, puis le texte. */
  coverTitle: string;
  coverHint: string;
  coverRatio: "video" | "square" | "portrait";
  captionTitle: string;
  captionHint: string;
  captionMax: number;
};

export const LONGFORM_SPECS: Record<LongformType, LongformSpec> = {
  long_video: {
    tab: "Chapitres",
    part: "chapitre",
    addLabel: "Ajouter un chapitre",
    hint: "Un chapitre par idée. Écris ce que tu dis face caméra.",
    titlePlaceholder: "Ex : L'erreur que tout le monde fait",
    bodyPlaceholder: "Ce que tu dis dans ce chapitre…",
    hasGuest: false,
    hasMinutes: false,
    coverTitle: "Miniature",
    coverHint: "L'image qui donne envie de cliquer, au format large.",
    coverRatio: "video",
    captionTitle: "Description",
    captionHint: "Le texte sous la vidéo.",
    captionMax: 5000,
  },
  livestream: {
    tab: "Déroulé",
    part: "étape",
    addLabel: "Ajouter une étape",
    hint: "Le fil de ton direct, étape par étape, avec le temps prévu.",
    titlePlaceholder: "Ex : Questions du public",
    bodyPlaceholder: "Ce que tu fais et dis à ce moment…",
    hasGuest: true,
    hasMinutes: true,
    coverTitle: "Visuel d'annonce",
    coverHint: "L'image qui annonce la date et l'heure de ton direct.",
    coverRatio: "portrait",
    captionTitle: "Texte d'annonce",
    captionHint: "Ce que tu publies pour faire venir du monde.",
    captionMax: 2200,
  },
  podcast: {
    tab: "Épisode",
    part: "question",
    addLabel: "Ajouter une question",
    hint: "Les questions et le fil de l'épisode, avec le temps prévu.",
    titlePlaceholder: "Ex : Comment tu as trouvé ton premier client ?",
    bodyPlaceholder: "Les relances, ce que tu veux faire ressortir…",
    hasGuest: true,
    hasMinutes: true,
    coverTitle: "Couverture",
    coverHint: "L'image carrée de l'épisode.",
    coverRatio: "square",
    captionTitle: "Description de l'épisode",
    captionHint: "Le texte sur Spotify et YouTube.",
    captionMax: 4000,
  },
  article: {
    tab: "Article",
    part: "partie",
    addLabel: "Ajouter une partie",
    hint: "Une introduction, des parties à intertitre court, une conclusion qui dit quoi faire.",
    titlePlaceholder: "Ex : Pourquoi ça ne marche pas",
    bodyPlaceholder: "Ton texte…",
    hasGuest: false,
    hasMinutes: false,
    coverTitle: "Image de couverture",
    coverHint: "L'image en haut de l'article ou de la newsletter.",
    coverRatio: "video",
    captionTitle: "Texte de partage",
    captionHint: "Il donne envie de lire, il ne répète pas l'article.",
    captionMax: 2200,
  },
};

export function longformSpec(type: string | null | undefined): LongformSpec | null {
  return (LONGFORM_SPECS as Record<string, LongformSpec>)[type ?? ""] ?? null;
}

/** Longueur maximale de la transcription — environ 2 h 30 d'échange. */
export const MAX_TRANSCRIPT_CHARS = 150_000;
/** Plus que ça, ce n'est plus un plan. */
export const MAX_PARTS = 60;

export function countWords(text: string | null | undefined): number {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

/** Débit d'une voix posée (français et arabe parlés), en mots par minute. */
const SPOKEN_WPM = 150;
const READING_WPM = 220;

const minutesFor = (words: number, wpm: number) =>
  words === 0 ? 0 : Math.max(1, Math.round(words / wpm));

/** Le compteur de l'en-tête, dans les mots de chaque format. */
export function lengthLabel(
  type: string | null | undefined,
  parts: { body: string | null; minutes: number | null }[],
): string {
  const words = parts.reduce((n, p) => n + countWords(p.body), 0);
  if (longformSpec(type)?.hasMinutes) {
    const planned = parts.reduce((n, p) => n + (p.minutes ?? 0), 0);
    return planned > 0 ? `${planned} min prévues` : "";
  }
  if (words === 0) return "";
  if (type === "article") {
    return `${words} mots · ≈ ${minutesFor(words, READING_WPM)} min de lecture`;
  }
  return `≈ ${minutesFor(words, SPOKEN_WPM)} min à l'oral`;
}

export type LongformPart = {
  id: string;
  title: string;
  body: string;
  minutes: number | null;
  /** Article seulement : introduction, point numéroté, texte, conclusion. */
  role?: string | null;
};

export type LongformDraft = {
  /** Article seulement. */
  subtitle?: string;
  parts: LongformPart[];
  guestName: string;
  guestBio: string;
};

const samePart = (a: LongformPart, b: LongformPart) =>
  a.title === b.title &&
  a.body === b.body &&
  a.minutes === b.minutes &&
  (a.role ?? null) === (b.role ?? null);

/**
 * Trois versions d'un même texte : ce qui est à l'écran, ce que l'écran croyait
 * enregistré, et ce que la base dit maintenant. Partie par partie, ce qu'elle a
 * touché reste ; ce qu'elle n'a pas touché suit la base — y compris ce qu'une
 * collègue vient d'ajouter ou de retirer.
 */
export function mergeLongform(
  current: LongformDraft,
  baseline: LongformDraft,
  incoming: LongformDraft,
): LongformDraft {
  const base = new Map(baseline.parts.map((p) => [p.id, p]));
  const next = new Map(incoming.parts.map((p) => [p.id, p]));
  const here = new Set(current.parts.map((p) => p.id));

  const kept = current.parts.flatMap((p) => {
    const was = base.get(p.id);
    const touched = !was || !samePart(p, was);
    if (touched) return [p];
    const now = next.get(p.id);
    return now ? [now] : [];
  });
  // Absente d'ici et inconnue avant : ajoutée ailleurs. Absente d'ici mais
  // connue avant : retirée ici, elle ne revient pas.
  const added = incoming.parts.filter((p) => !here.has(p.id) && !base.has(p.id));

  const pickField = <K extends "guestName" | "guestBio" | "subtitle">(key: K) =>
    current[key] !== baseline[key] ? current[key] : incoming[key];

  const order = (parts: LongformPart[]) => parts.map((p) => p.id).join();
  const moved =
    order(current.parts.filter((p) => base.has(p.id))) !==
    order(baseline.parts.filter((p) => here.has(p.id)));
  const merged = [...kept, ...added];
  if (!moved) {
    // Elle n'a rien déplacé : l'ordre de la base fait foi, ses ajouts suivent.
    const rank = new Map(incoming.parts.map((p, i) => [p.id, i]));
    merged.sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }
  return {
    subtitle: pickField("subtitle"),
    parts: merged,
    guestName: pickField("guestName"),
    guestBio: pickField("guestBio"),
  };
}

/** Ce qu'il faut vraiment envoyer : les parties touchées, l'ordre, les retraits. */
export function longformChanges(
  saved: LongformDraft,
  draft: LongformDraft,
): {
  /** `existing` : la base la connaît. Si elle a disparu, l'article a été remplacé. */
  changed: (LongformPart & { existing: boolean })[];
  order: string[];
  deleted: string[];
  guest?: { name: string; bio: string };
  subtitle?: string;
} {
  const was = new Map(saved.parts.map((p) => [p.id, p]));
  const now = new Set(draft.parts.map((p) => p.id));
  return {
    changed: draft.parts.flatMap((p) => {
      const before = was.get(p.id);
      return before && samePart(before, p) ? [] : [{ ...p, existing: Boolean(before) }];
    }),
    order: draft.parts.map((p) => p.id),
    deleted: saved.parts.map((p) => p.id).filter((id) => !now.has(id)),
    ...(draft.guestName !== saved.guestName || draft.guestBio !== saved.guestBio
      ? { guest: { name: draft.guestName, bio: draft.guestBio } }
      : {}),
    ...((draft.subtitle ?? "") !== (saved.subtitle ?? "")
      ? { subtitle: draft.subtitle ?? "" }
      : {}),
  };
}

/** La langue d'un texte déjà écrit, pour ne pas la changer en le réécrivant. */
export function detectLanguage(text: string): "fr" | "en" | "ar_tn" {
  if (/[\u0600-\u06FF]/.test(text)) return "ar_tn";
  const t = ` ${text.toLowerCase().replace(/[^\p{L}]+/gu, " ")} `;
  const count = (re: RegExp) => t.match(re)?.length ?? 0;
  const en = count(/ (?:the|and|you|your|is|of|to|that|with) /g);
  const fr = count(/ (?:le|la|les|et|tu|vous|est|des|une|que|pour) /g);
  return en > fr ? "en" : "fr";
}

/** Au-delà, une réécriture d'un bloc ampute le texte : il faut le découper. */
export const MAX_REWRITE_WORDS = 450;

/** Toutes les parties en un seul texte — ce que le client relit, et ce que
 *  Krea prend comme source quand il n'y a pas de transcription. */
export function sectionsToText(
  parts: { title: string | null; body: string | null }[],
): string {
  return parts
    .map((p) => [p.title?.trim(), p.body?.trim()].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

/** Pour comparer une citation à sa source sans se faire piéger par une
 *  apostrophe courbe, une ponctuation ou un retour à la ligne. */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

/**
 * La citation vient-elle vraiment de la source ? Krea propose des extraits
 * « mot pour mot » : un modèle peut reformuler sans le dire, et on attribuerait
 * alors à un invité une phrase qu'il n'a jamais dite.
 */
export function quoteIsInSource(quote: string, source: string): boolean {
  const q = normalizeForMatch(quote);
  if (q.length < 15) return false;
  return ` ${normalizeForMatch(source)} `.includes(` ${q} `);
}

/** Les formats qu'on peut tirer d'un contenu long. */
export const EXTRACT_TYPES = ["reel", "carousel", "post"] as const;
export type ExtractType = (typeof EXTRACT_TYPES)[number];

export function isExtractType(t: string): t is ExtractType {
  return (EXTRACT_TYPES as readonly string[]).includes(t);
}

export type ExtractProposal = {
  type: ExtractType;
  title: string;
  /** Mot pour mot, vérifié contre la source. */
  quote: string;
  /** L'accroche affichée à l'écran, ou la première phrase de la légende. */
  hook: string;
  caption: string;
  /** Pourquoi ce passage mérite d'exister seul. */
  why: string;
};
