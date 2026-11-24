/* =========================================================================
   L'article — brief, structure, lecture de ce que Krea renvoie
   -------------------------------------------------------------------------
   Logique pure, testée : ni base, ni IA, ni React.
   ========================================================================= */

import { announcedCount } from "./article-checks";

export type ArticleRole = "intro" | "item" | "text" | "outro";

export function articleRole(role: string | null | undefined): ArticleRole {
  return role === "intro" || role === "item" || role === "outro" ? role : "text";
}

/**
 * Donne un rôle à chaque partie avant d'en changer une. Un article d'avant 0103
 * n'en a aucun et s'affiche numéroté : ses parties deviennent des points.
 */
export function withRoles<T extends { role?: string | null }>(parts: T[]): T[] {
  const legacy = parts.every((p) => !p.role);
  return parts.map((p) => ({
    ...p,
    role: p.role ?? (legacy ? "item" : "text"),
  }));
}

/** Introduction et conclusion : sans intertitre, sans numéro, à leur place. */
export function isEdgeRole(role: string | null | undefined): boolean {
  return role === "intro" || role === "outro";
}

/**
 * Le numéro AFFICHÉ d'une partie, ou `null`. Un article ne numérote que ce que
 * son titre annonce ; les autres formats longs numérotent toutes leurs parties.
 */
export function partNumber(
  type: string | null | undefined,
  parts: { role?: string | null }[],
  index: number,
): number | null {
  // Un article d'avant 0103 n'a aucun rôle : il reste numéroté comme il l'était.
  if (type !== "article" || parts.every((p) => !p.role)) return index + 1;
  if (parts[index]?.role !== "item") return null;
  return parts.slice(0, index + 1).filter((p) => p.role === "item").length;
}

/* ------------------------------- Le brief -------------------------------- */

export type ArticlePosition = "supplier" | "expert" | "client";
export type ArticleLanguage = "fr" | "en" | "ar_tn" | "ar_msa";
export type ArticleEdition = "single" | "first" | "next";

export type ArticleBrief = {
  /** Qui lit : fonction, pays, niveau sur le sujet. */
  reader: string;
  /** Ce que le lecteur doit faire après lecture. */
  action: string;
  /** Faits, chiffres, exemples vécus à citer. */
  proofs: string;
  /** Ce que l'auteur ne peut pas promettre. */
  limits: string;
  /** Qui signe : nom et rôle. */
  author: string;
  position: ArticlePosition | "";
  /** D'où il parle — les exemples viennent de là. */
  context: string;
  /** Comment le joindre. */
  contact: string;
  language: ArticleLanguage;
  words: number;
  edition: ArticleEdition;
  /** Newsletter : ce qu'elle apportera, à quel rythme. */
  rhythm: string;
};

export const POSITION_LABELS: Record<ArticlePosition, string> = {
  supplier: "Je vends ce dont je parle",
  expert: "Je suis expert du sujet",
  client: "Je l'utilise, j'en suis client",
};

export const EDITION_LABELS: Record<ArticleEdition, string> = {
  single: "Article seul",
  first: "Première édition d'une newsletter",
  next: "Suite d'un article précédent",
};

/** Un article complet s'écrit en un appel : au-delà, il ne tient plus à temps. */
export const WORD_OPTIONS = [600, 700, 800, 900] as const;
export const DEFAULT_WORDS = 700;
export const MAX_ARTICLE_WORDS = 900;

export const EMPTY_BRIEF: ArticleBrief = {
  reader: "",
  action: "",
  proofs: "",
  limits: "",
  author: "",
  position: "",
  context: "",
  contact: "",
  language: "fr",
  words: DEFAULT_WORDS,
  edition: "single",
  rhythm: "",
};

/** Ce qui ne change pas d'un article à l'autre : demandé une fois par marque. */
export const SHEET_FIELDS = [
  "author",
  "position",
  "context",
  "proofs",
  "limits",
  "contact",
  "rhythm",
] as const;
export type SheetField = (typeof SHEET_FIELDS)[number];
export type AuthorSheet = Partial<Record<SheetField, string>>;

const MAX_FIELD = 3000;
const text = (v: unknown, max = MAX_FIELD) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export function cleanSheet(raw: unknown): AuthorSheet {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sheet: AuthorSheet = {};
  for (const f of SHEET_FIELDS) {
    const v = text(src[f]);
    if (v && (f !== "position" || v in POSITION_LABELS)) sheet[f] = v;
  }
  return sheet;
}

/** Ne fait jamais confiance à l'écran : chaque champ est borné et vérifié. */
export function cleanBrief(raw: unknown): ArticleBrief {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const position = text(src.position);
  const language = text(src.language);
  const edition = text(src.edition);
  const words = Number(src.words);
  return {
    reader: text(src.reader),
    action: text(src.action),
    proofs: text(src.proofs),
    limits: text(src.limits),
    author: text(src.author),
    position: position in POSITION_LABELS ? (position as ArticlePosition) : "",
    context: text(src.context),
    contact: text(src.contact, 300),
    language: (["fr", "en", "ar_tn", "ar_msa"] as string[]).includes(language)
      ? (language as ArticleLanguage)
      : "fr",
    words: (WORD_OPTIONS as readonly number[]).includes(words) ? words : DEFAULT_WORDS,
    edition: edition in EDITION_LABELS ? (edition as ArticleEdition) : "single",
    rhythm: text(src.rhythm, 300),
  };
}

/**
 * Le brief de départ : celui de cet article s'il existe, sinon ce que l'on sait
 * déjà du client — sa fiche auteur, puis sa stratégie de marque. On ne redemande
 * que le vide.
 */
export function prefillBrief(input: {
  saved?: unknown;
  sheet?: unknown;
  /** Réponses du Studio de marque (`brand_strategies.answers`). */
  answers?: Record<string, string> | null;
  audience?: { name: string; who: string; wants: string } | null;
}): ArticleBrief {
  if (input.saved) return cleanBrief(input.saved);
  const sheet = cleanSheet(input.sheet);
  const a = input.answers ?? {};
  const known = (...keys: string[]) =>
    keys
      .map((k) => a[k]?.trim())
      .filter(Boolean)
      .join("\n");
  return {
    ...EMPTY_BRIEF,
    reader: input.audience
      ? [input.audience.name, input.audience.who].filter(Boolean).join(" — ")
      : "",
    author: sheet.author ?? known("who_you_are"),
    position: (sheet.position as ArticlePosition) ?? "",
    context: sheet.context ?? "",
    proofs: sheet.proofs ?? known("proof_result", "legitimacy", "customer_words"),
    limits: sheet.limits ?? known("show_or_not"),
    contact: sheet.contact ?? "",
    rhythm: sheet.rhythm ?? "",
  };
}

/** Les champs de la fiche que ce brief remplit ou change. */
export function sheetChanges(
  sheet: AuthorSheet,
  brief: ArticleBrief,
): { added: SheetField[]; changed: SheetField[] } {
  const added: SheetField[] = [];
  const changed: SheetField[] = [];
  for (const f of SHEET_FIELDS) {
    const now = String(brief[f] ?? "").trim();
    if (!now) continue;
    if (!sheet[f]) added.push(f);
    else if (sheet[f] !== now) changed.push(f);
  }
  return { added, changed };
}

/** Compléter un vide enregistre ; modifier un acquis seulement si on le demande. */
export function mergeSheet(
  sheet: AuthorSheet,
  brief: ArticleBrief,
  keepChanges: boolean,
): AuthorSheet {
  const { added, changed } = sheetChanges(sheet, brief);
  const next: AuthorSheet = { ...sheet };
  for (const f of keepChanges ? [...added, ...changed] : added) {
    next[f] = String(brief[f]).trim();
  }
  return next;
}

/** La ligne qui résume le brief une fois rempli. */
export function briefSummary(brief: ArticleBrief): string {
  return [brief.reader, brief.action, `${brief.words} mots`]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

/* ------------------------- Ce que Krea renvoie --------------------------- */

export type ArticleDraftPart = { role: ArticleRole; title: string; body: string };

export type ArticleDraft = {
  titles: string[];
  subtitle: string;
  intro: string;
  parts: { title: string; body: string }[];
  outro: string;
  share: string;
  coverBrief: string;
  claims: string[];
  /** Ce qui manque parce que la réponse a été coupée, dans les mots de l'écran. */
  missing: string[];
};

const MARKERS = {
  titles: "TITRES",
  subtitle: "SOUS-TITRE",
  intro: "INTRODUCTION",
  part: "PARTIE",
  outro: "CONCLUSION",
  share: "PARTAGE",
  cover: "IMAGE",
  claims: "A-VALIDER",
  end: "FIN",
} as const;

/** Le gabarit montré au modèle. Balises et non JSON : un guillemet mal placé ne
 *  fait pas perdre un article entier, et une réponse coupée garde ses blocs. */
export const ARTICLE_TEMPLATE = `@@TITRES@@
- premier titre
- deuxième titre
- troisième titre
@@SOUS-TITRE@@
une ligne
@@INTRODUCTION@@
un paragraphe
@@PARTIE@@ intertitre
texte de la partie
@@PARTIE@@ intertitre
texte de la partie
@@CONCLUSION@@
un paragraphe
@@PARTAGE@@
texte de partage
@@IMAGE@@
brief de l'image
@@A-VALIDER@@
- une affirmation
@@FIN@@`;

// L'espace après la puce est exigé : « 0.8 % » et « -18 °C » ne sont pas des listes.
const listOf = (block: string) =>
  block
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s+/, "").trim())
    .filter(Boolean);

/** « 3. Mon intertitre » : le numéro est calculé, il n'a rien à faire là. */
const stripNumber = (title: string) =>
  title.replace(/^\s*(?:#+\s*)?\**(?:\d{1,2}\s*[.):–-]\s+)?/, "").replace(/^\*+|\*+$/g, "").trim();

/**
 * Lit la réponse balisée. Coupée (`truncated`), son dernier bloc est incomplet et
 * n'est pas retenu ; finie normalement, il l'est même sans la balise FIN.
 */
export function parseArticle(source: string, truncated = false): ArticleDraft {
  const raw = source.replace(/\r\n?/g, "\n");
  const re = /^[ \t]*@@\s*([A-ZÀ-Ý-]+)(?:\s*\d+)?\s*@@[ \t]*(.*)$/gmu;
  const hits = [...raw.matchAll(re)];
  const draft: ArticleDraft = {
    titles: [],
    subtitle: "",
    intro: "",
    parts: [],
    outro: "",
    share: "",
    coverBrief: "",
    claims: [],
    missing: [],
  };
  const closed = new Set<string>();

  hits.forEach((m, i) => {
    const name = m[1].normalize("NFD").replace(/\p{M}/gu, "");
    const next = hits[i + 1];
    if (!next && truncated) return;
    const body = raw.slice(m.index + m[0].length, next?.index).trim();
    const inline = m[2].trim();
    const full = [inline, body].filter(Boolean).join("\n").trim();
    closed.add(name);
    switch (name) {
      case MARKERS.titles:
        draft.titles = listOf(full).map(stripLeadingQuotes).slice(0, 3);
        break;
      case MARKERS.subtitle:
        draft.subtitle = full.split("\n")[0]?.trim().slice(0, 300) ?? "";
        break;
      case MARKERS.intro:
        draft.intro = full;
        break;
      case MARKERS.part: {
        // L'intertitre est sur la ligne de la balise, ou sur la suivante.
        const [first, ...rest] = full.split("\n");
        const title = stripNumber(inline || first || "").slice(0, 300);
        const text = inline ? body : rest.join("\n").trim();
        if (text) draft.parts.push({ title, body: text });
        break;
      }
      case MARKERS.outro:
        draft.outro = full;
        break;
      case MARKERS.share:
        draft.share = full;
        break;
      case MARKERS.cover:
        draft.coverBrief = full.slice(0, 4000);
        break;
      case MARKERS.claims:
        draft.claims = listOf(full)
          .filter((c) => !/^(aucune?|rien|none|néant)\.?$/i.test(c))
          .map((c) => c.slice(0, 600))
          .slice(0, 12);
        break;
    }
  });

  const complete = withMissing(draft);
  // Une liste vide peut être juste ; une liste jamais écrite, non : le client
  // validerait sans savoir quoi vérifier.
  if (!closed.has(MARKERS.cover)) complete.missing.push("l'idée d'image");
  if (!closed.has(MARKERS.claims)) complete.missing.push(MISSING_CLAIMS);
  return complete;
}

const MISSING_CLAIMS = "les points à valider";

/** La réponse a été coupée avant la liste : ne pas la confondre avec « aucune ». */
export function claimsMissing(draft: ArticleDraft): boolean {
  return draft.missing.includes(MISSING_CLAIMS);
}

const stripLeadingQuotes = (t: string) => t.replace(/^[«"“\s]+|[»"”\s]+$/gu, "").trim();

export function withMissing(draft: ArticleDraft): ArticleDraft {
  const missing: string[] = [];
  if (draft.titles.length === 0) missing.push("les titres");
  if (!draft.intro) missing.push("l'introduction");
  if (draft.parts.length === 0) missing.push("les parties");
  if (!draft.outro) missing.push("la conclusion");
  if (!draft.share) missing.push("le texte de partage");
  return { ...draft, missing };
}

/** Assez pour être montré et gardé : un texte, même s'il en manque un bout. */
export function isUsableDraft(draft: ArticleDraft): boolean {
  return draft.parts.length > 0 && Boolean(draft.intro || draft.parts.length > 1);
}

/** Un brouillon relu en base : jamais tenu pour valide sans l'être. */
export function cleanDraft(raw: unknown): ArticleDraft | null {
  const r = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!r) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => text(x, 600)).filter(Boolean) : []);
  const parts = (Array.isArray(r.parts) ? r.parts : [])
    .map((p: Record<string, unknown>) => ({
      title: stripNumber(text(p?.title, 300)),
      body: text(p?.body, 20000),
    }))
    .filter((p) => p.body);
  const draft = withMissing({
    titles: list(r.titles).slice(0, 3),
    subtitle: text(r.subtitle, 300),
    intro: text(r.intro, 20000),
    parts,
    outro: text(r.outro, 20000),
    share: text(r.share, 6000),
    coverBrief: text(r.coverBrief, 4000),
    claims: list(r.claims).slice(0, 12),
    missing: [],
  });
  for (const m of list(r.missing)) {
    if (!draft.missing.includes(m)) draft.missing.push(m);
  }
  return isUsableDraft(draft) ? draft : null;
}

/** Les parties à enregistrer, numérotées seulement si le titre choisi l'annonce. */
export function draftParts(draft: ArticleDraft, title: string): ArticleDraftPart[] {
  const numbered = announcedCount(title) === draft.parts.length;
  return [
    ...(draft.intro ? [{ role: "intro" as const, title: "", body: draft.intro }] : []),
    ...draft.parts.map((p) => ({
      role: (numbered ? "item" : "text") as ArticleRole,
      title: p.title,
      body: p.body,
    })),
    ...(draft.outro ? [{ role: "outro" as const, title: "", body: draft.outro }] : []),
  ];
}

/* ------------------------- Placer les parties ---------------------------- */

/** L'introduction ouvre, la conclusion ferme, quoi qu'on ajoute ou déplace. */
export function orderParts<T extends { role?: string | null }>(parts: T[]): T[] {
  return [
    ...parts.filter((p) => p.role === "intro"),
    ...parts.filter((p) => !isEdgeRole(p.role)),
    ...parts.filter((p) => p.role === "outro"),
  ];
}

/** Numéroter ou non toutes les parties du corps, d'un geste. */
export function setNumbering<T extends { role?: string | null }>(parts: T[], on: boolean): T[] {
  return parts.map((p) => (isEdgeRole(p.role) ? p : { ...p, role: on ? "item" : "text" }));
}
