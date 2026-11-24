/* =========================================================================
   Le cahier des charges d'un article, vérifié par du code
   -------------------------------------------------------------------------
   Ce que Krea promet dans sa consigne, on le CONTRÔLE ici : un modèle oublie,
   une relecture aussi. Rien n'est bloqué, tout est signalé. Logique pure,
   testée, sans appel IA — donc instantanée et gratuite.
   ========================================================================= */

export type ArticlePartRole = "intro" | "item" | "text" | "outro";

export type ArticleCheckPart = {
  id: string;
  role: ArticlePartRole;
  title: string;
  body: string;
};

export type ArticleIssue = {
  code:
    | "to_confirm"
    | "heading_long"
    | "intro_heading"
    | "no_intro"
    | "no_outro"
    | "outro_contact"
    | "length"
    | "numbering_missing"
    | "numbering_mismatch"
    | "numbering_unannounced"
    | "same_ending"
    | "repeated_sentence"
    | "share_copied"
    | "share_hashtags"
    | "share_emoji"
    | "share_promise"
    | "share_voice";
  message: string;
  /** La partie concernée, pour y mener d'un clic. Absente : tout l'article. */
  partId?: string;
  /** Où corriger : l'article, ou le texte de partage. */
  where: "article" | "share";
};

/** Ce que Krea écrit quand une information manque : jamais une invention. */
export const TO_CONFIRM = "[À CONFIRMER]";
// Tout ce qui commence ainsi entre crochets, quelle que soit la suite : « [À
// CONFIRMER le prix] », « [À CONFIRMER - délai] »…
const TO_CONFIRM_RE = /\[\s*(?:[àa]\s+confirmer|to\s+(?:be\s+)?confirm(?:ed)?)(?![\p{L}\p{N}])[^\]]{0,300}\]/giu;

export const MAX_HEADING_WORDS = 8;
export const MAX_SHARE_HASHTAGS = 3;
/** L'écart toléré autour de la longueur demandée. */
const LENGTH_TOLERANCE = 0.2;

export function countToConfirm(text: string): number {
  return text.normalize("NFC").match(TO_CONFIRM_RE)?.length ?? 0;
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();

const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?؟…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);

// Pas « neuf » : « un appartement neuf » n'annonce pas neuf points.
const NUMBER_WORDS: Record<string, number> = {
  deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, dix: 10,
  two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10,
  ثلاث: 3, ثلاثة: 3, أربع: 4, أربعة: 4, خمس: 5, خمسة: 5, ست: 6, ستة: 6,
  سبع: 7, سبعة: 7, ثماني: 8, ثمانية: 8, تسع: 9, تسعة: 9, عشر: 10, عشرة: 10,
};

/** Après un nombre, ces mots en font une durée, un prix ou une quantité. */
const UNITS =
  /^\s*(?:%|€|\$|(?:dt|tnd|dinars?|euros?|h|heures?|hours?|ans?|années?|years?|mois|months?|semaines?|weeks?|jours?|days?|minutes?|min|kg|km|mots?|words?|سنوات|سنة|سنين|أيام|يوم|شهر|أشهر|دقائق|دينار)(?![\p{L}\p{N}]))/iu;

/**
 * Le nombre que le titre annonce (« 5 questions à poser », « Les trois
 * erreurs »). Une année, un pourcentage ou un prix n'annoncent pas une liste.
 */
export function announcedCount(title: string): number | null {
  const t = title
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  for (const m of t.matchAll(/(?<![\p{L}\p{N}.,])(\d{1,2})(?![\p{N}.,]?\p{N})/gu)) {
    const n = Number(m[1]);
    if (n >= 2 && n <= 20 && !UNITS.test(t.slice(m.index + m[0].length))) return n;
  }
  for (const m of t.matchAll(/\p{L}+/gu)) {
    const n = Object.hasOwn(NUMBER_WORDS, m[0]) ? NUMBER_WORDS[m[0]] : null;
    if (n && !UNITS.test(t.slice(m.index + m[0].length))) return n;
  }
  return null;
}

/** Première personne : « je » ou « nous », quand c'est net. */
function voiceOf(text: string): "je" | "nous" | null {
  const t = ` ${normalize(text)} `;
  const count = (re: RegExp) => t.match(re)?.length ?? 0;
  const je = count(/ (?:je|j|mon|ma|mes|moi|i|my|me) /g);
  const nous = count(/ (?:nous|notre|nos|we|our|us) /g);
  if (je + nous < 2) return null;
  if (je >= nous * 2) return "je";
  if (nous >= je * 2) return "nous";
  return null;
}

/** Une adresse, un site ou un numéro du contact suffit : le reste se reformule. */
function mentionsContact(text: string, contact: string): boolean {
  const flat = text.toLowerCase();
  const digits = (s: string) => s.replace(/\D/g, "");
  const tokens = contact.toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const exact = tokens.filter((t) => t.includes("@") || /\p{L}\.\p{L}/u.test(t));
  if (exact.some((t) => flat.includes(t.replace(/^https?:\/\//, "").replace(/\/$/, "")))) {
    return true;
  }
  const phone = digits(contact);
  if (phone.length >= 6 && digits(text).includes(phone.slice(-8))) return true;
  if (exact.length || phone.length >= 6) return false;
  const known = new Set(normalize(text).split(" "));
  return normalize(contact)
    .split(" ")
    .some((w) => w.length >= 4 && known.has(w));
}

export function checkArticle(input: {
  title: string;
  subtitle?: string;
  parts: ArticleCheckPart[];
  shareText: string;
  targetWords: number;
  /** Le moyen de contact du brief, qui doit se retrouver à la fin. */
  contact?: string;
}): ArticleIssue[] {
  const issues: ArticleIssue[] = [];
  const parts = input.parts.filter((p) => p.title.trim() || p.body.trim());
  if (parts.length === 0) return issues;

  const intro = parts.find((p) => p.role === "intro");
  const outro = parts.find((p) => p.role === "outro");
  const body = parts.filter((p) => p.role === "item" || p.role === "text");
  const items = body.filter((p) => p.role === "item");
  const label = (p: ArticleCheckPart) =>
    p.role === "intro"
      ? "l'introduction"
      : p.role === "outro"
        ? "la conclusion"
        : `« ${p.title.trim() || "sans titre"} »`;

  /* --- Ce qui reste à confirmer, d'abord : c'est ce qui engage l'auteur --- */
  if (countToConfirm(`${input.title}\n${input.subtitle ?? ""}`)) {
    issues.push({
      code: "to_confirm",
      where: "article",
      message: "Une information à confirmer dans le titre ou le sous-titre.",
    });
  }
  for (const p of parts) {
    const n = countToConfirm(`${p.title}\n${p.body}`);
    if (n) {
      issues.push({
        code: "to_confirm",
        where: "article",
        partId: p.id,
        message: `${n} information${n > 1 ? "s" : ""} à confirmer dans ${label(p)}.`,
      });
    }
  }

  /* --- Structure --- */
  if (!intro) {
    issues.push({ code: "no_intro", where: "article", message: "Il manque une introduction." });
  }
  if (!outro) {
    issues.push({ code: "no_outro", where: "article", message: "Il manque une conclusion." });
  }
  for (const p of parts) {
    const edge = p.role === "intro" || p.role === "outro";
    if (edge && p.title.trim()) {
      issues.push({
        code: "intro_heading",
        where: "article",
        partId: p.id,
        message: `${p.role === "intro" ? "L'introduction" : "La conclusion"} n'a pas besoin d'intertitre.`,
      });
    }
    const n = words(p.title).length;
    if (!edge && n > MAX_HEADING_WORDS) {
      issues.push({
        code: "heading_long",
        where: "article",
        partId: p.id,
        message: `L'intertitre ${label(p)} est long : ${MAX_HEADING_WORDS} mots suffisent.`,
      });
    }
  }
  if (outro && input.contact?.trim() && !mentionsContact(outro.body, input.contact)) {
    issues.push({
      code: "outro_contact",
      where: "article",
      partId: outro.id,
      message: "La conclusion ne dit pas comment te contacter.",
    });
  }

  const announced = announcedCount(input.title);
  if (announced && items.length === 0) {
    issues.push({
      code: "numbering_missing",
      where: "article",
      message: `Le titre annonce ${announced} points : numérote les parties.`,
    });
  } else if (announced && announced !== items.length) {
    issues.push({
      code: "numbering_mismatch",
      where: "article",
      message: `Le titre annonce ${announced} points, l'article en numérote ${items.length}.`,
    });
  } else if (!announced && items.length > 0) {
    issues.push({
      code: "numbering_unannounced",
      where: "article",
      message: "Les parties sont numérotées mais le titre n'annonce aucun nombre.",
    });
  }

  /* --- Style --- */
  const total = parts.reduce((n, p) => n + words(p.body).length, 0);
  const min = Math.round(input.targetWords * (1 - LENGTH_TOLERANCE));
  const max = Math.round(input.targetWords * (1 + LENGTH_TOLERANCE));
  if (total > max || total < min) {
    issues.push({
      code: "length",
      where: "article",
      message: `${total} mots pour ${input.targetWords} demandés : ${total > max ? "raccourcis" : "développe"}.`,
    });
  }

  const endings = new Map<string, string[]>();
  for (const p of body) {
    const last = sentences(p.body).at(-1);
    const key = last ? normalize(last).split(" ").slice(0, 3).join(" ") : "";
    if (key.split(" ").length === 3) endings.set(key, [...(endings.get(key) ?? []), p.id]);
  }
  for (const ids of endings.values()) {
    if (ids.length > 1) {
      issues.push({
        code: "same_ending",
        where: "article",
        partId: ids[1],
        message: `${ids.length} parties se terminent par la même formule.`,
      });
    }
  }

  const seen = new Map<string, string>();
  const reported = new Set<string>();
  for (const p of parts) {
    for (const s of sentences(p.body)) {
      const key = normalize(s);
      if (key.split(" ").length < 8) continue;
      if (seen.has(key) && !reported.has(key)) {
        reported.add(key);
        issues.push({
          code: "repeated_sentence",
          where: "article",
          partId: p.id,
          message: `Une phrase revient deux fois, dont dans ${label(p)}.`,
        });
      }
      seen.set(key, p.id);
    }
  }

  /* --- Texte de partage --- */
  const share = input.shareText.trim();
  if (share) {
    const whole = ` ${normalize(parts.map((p) => `${p.title}\n${p.body}`).join("\n"))} `;
    const copied = sentences(share).find((s) => {
      const key = normalize(s);
      return key.split(" ").length >= 6 && whole.includes(` ${key} `);
    });
    if (copied) {
      issues.push({
        code: "share_copied",
        where: "share",
        message: "Le texte de partage recopie une phrase de l'article.",
      });
    }
    const tags = share.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
    if (tags > MAX_SHARE_HASHTAGS) {
      issues.push({
        code: "share_hashtags",
        where: "share",
        message: `${tags} hashtags dans le texte de partage : ${MAX_SHARE_HASHTAGS} au maximum.`,
      });
    }
    if (/\p{Extended_Pictographic}/u.test(share)) {
      issues.push({
        code: "share_emoji",
        where: "share",
        message: "Le texte de partage contient des emojis : il s'en passe.",
      });
    }
    const promise = share.match(
      /(?<![\p{L}\p{N}])(check-?list|pdf|guide gratuit|free guide|template|lien en bio|lien en commentaire|link in (?:the )?(?:bio|comments?)|à télécharger|download)(?![\p{L}\p{N}])/iu,
    );
    if (promise) {
      issues.push({
        code: "share_promise",
        where: "share",
        message: `Le texte de partage promet « ${promise[0]} » : vérifie que ça existe.`,
      });
    }
    const a = voiceOf(parts.map((p) => p.body).join(" "));
    const b = voiceOf(share);
    if (a && b && a !== b) {
      issues.push({
        code: "share_voice",
        where: "share",
        message: `L'article dit « ${a} », le texte de partage dit « ${b} ».`,
      });
    }
    if (countToConfirm(share)) {
      issues.push({
        code: "to_confirm",
        where: "share",
        message: "Il reste une information à confirmer dans le texte de partage.",
      });
    }
  }
  return issues;
}
