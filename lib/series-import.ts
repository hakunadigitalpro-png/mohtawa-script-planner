/* =========================================================================
   Import d'une série de contenus
   -------------------------------------------------------------------------
   Coller une liste de sujets déjà rédigés et obtenir N fiches, titrées,
   scriptées et datées. Aucune IA : le texte est déjà écrit, le découper est
   du travail mécanique — donc instantané, gratuit et prévisible. Une IA qui
   « comprend » une liste numérotée réintroduirait de l'incertitude là où il
   n'y en a pas.
   ========================================================================= */

export type ParsedItem = {
  /** Numéro d'origine dans le texte collé — sert de repère à l'écran. */
  number: number;
  /** La ligne numérotée elle-même : chez l'utilisatrice, la question posée. */
  title: string;
  /** Tout ce qui suit, jusqu'au sujet suivant : l'angle développé. */
  script: string;
};

/** Une ligne « 12. Mon titre » ou « 12) Mon titre ». */
const NUMBERED = /^\s{0,3}(\d{1,3})[.)]\s+(\S.*)$/;

/**
 * Lignes de structure d'un document rédigé — des intertitres, pas des sujets.
 * Sans ce filtre, « Batch 2 — Personal Branding » finirait collé à la fin du
 * script du sujet précédent.
 */
const SECTION_LINE = /^\s*(batch|partie|section|lot)\s+\d+\b/i;
const SEPARATOR_LINE = /^\s*[-—_*=]{3,}\s*$/;

/**
 * Découpe un texte en sujets numérotés.
 *
 * La numérotation doit être CONTINUE : on part du premier numéro trouvé et on
 * n'accepte que le suivant attendu. C'est ce qui évite le piège classique —
 * une liste « 1. / 2. / 3. » imbriquée à l'intérieur d'un sujet serait sinon
 * prise pour de nouveaux sujets et couperait le script en morceaux.
 */
export function parseSeries(raw: string): ParsedItem[] {
  const lines = raw.split(/\r?\n/);
  const items: ParsedItem[] = [];
  let expected: number | null = null;
  let current: { number: number; title: string; body: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const script = current.body
      .filter((l) => !SECTION_LINE.test(l) && !SEPARATOR_LINE.test(l))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    items.push({ number: current.number, title: current.title, script });
    current = null;
  };

  for (const line of lines) {
    const m = line.match(NUMBERED);
    const n = m ? Number(m[1]) : null;
    const startsNewItem =
      m && n !== null && (expected === null ? true : n === expected);

    if (startsNewItem && m) {
      flush();
      current = { number: n as number, title: m[2].trim(), body: [] };
      expected = (n as number) + 1;
    } else if (current) {
      current.body.push(line);
    }
    // Avant le premier sujet, on ignore tout (titre du document, intro…).
  }
  flush();

  return items;
}

/**
 * Répartit N contenus à partir d'une date, à la cadence voulue.
 *
 * Le pas est calculé en fraction de semaine plutôt qu'arrondi une fois pour
 * toutes : à 3 par semaine, un pas fixe de 2 jours donnerait 3,5 publications
 * par semaine et la cadence dériverait sur un mois.
 */
export function spreadDates(
  start: string,
  count: number,
  perWeek: number,
): string[] {
  const base = new Date(`${start}T12:00:00`);
  if (Number.isNaN(base.getTime()) || perWeek < 1) return [];

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + Math.round((i * 7) / perWeek));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Au-delà, ce n'est plus une série : c'est un accident de copier-coller. */
export const MAX_SERIES_ITEMS = 50;

/**
 * Formats acceptés à l'import. La Story est volontairement absente : son
 * contenu vit en 5 diapositives numérotées, un bloc de texte long n'aurait
 * nulle part où aller sans être découpé arbitrairement.
 *
 * Défini ICI et pas à côté de l'action : un fichier `"use server"` ne peut
 * exporter que des fonctions asynchrones. Y exporter ce tableau faisait
 * planter la route au chargement du module — d'où l'erreur 500 au moment de
 * valider, alors que la page s'affichait normalement.
 */
export const IMPORTABLE_TYPES = [
  "reel",
  "vlog",
  "post",
  "carousel",
  "infographic",
] as const;

export type ImportableType = (typeof IMPORTABLE_TYPES)[number];
