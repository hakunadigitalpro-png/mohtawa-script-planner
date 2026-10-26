/**
 * Marqueurs des temps forts du calendrier Maghreb (Tunisie en priorité,
 * suit la logique « marché local » du benchmark Airtable d'octobre 2026).
 *
 * Trois usages :
 *  - afficher une pastille sur la case du jour dans /calendar
 *  - suggérer un pilier pertinent (ex. Ramadan → bien-être, Soldes → promo)
 *  - alimenter plus tard les suggestions de bulk-génération IA
 *
 * Dates hégiriennes converties en grégorien pour 2026 et 2027. Les dates
 * religieuses dépendent de l'observation lunaire — on prend la date
 * officielle Tunisie quand elle existe, sinon le calcul standard.
 */

export type MaghrebEvent = {
  /** Première date couverte (ISO yyyy-mm-dd). */
  from: string;
  /** Dernière date couverte, incluse. Égale à `from` pour un jour unique. */
  to: string;
  /** Nom court montré dans la case. */
  label: string;
  /** Catégorie, pour la couleur de la pastille. */
  kind: "religious" | "national" | "commercial" | "seasonal";
  /** Suggestion de ton éditorial, lue par les suggestions IA. */
  hint?: string;
};

export const MAGHREB_EVENTS: MaghrebEvent[] = [
  // 2026 — reste de l'année
  { from: "2026-10-26", to: "2026-10-26", label: "Mouled", kind: "religious", hint: "Fête du Mawlid an-Nabawi — ton respectueux, pas de promo agressive." },
  { from: "2026-11-15", to: "2026-11-15", label: "Jour de l'évacuation", kind: "national" },
  { from: "2026-12-20", to: "2027-02-15", label: "Soldes d'hiver TN", kind: "commercial", hint: "Communique sur tes offres : contenus réduction, codes promo, cross-sell." },

  // 2027
  { from: "2027-01-14", to: "2027-01-14", label: "Fête de la Révolution", kind: "national" },
  { from: "2027-02-17", to: "2027-03-18", label: "Ramadan", kind: "religious", hint: "Horaire décalé (publier le soir), ton bienveillant, contenus bien-être / cuisine / famille." },
  { from: "2027-03-19", to: "2027-03-21", label: "Aïd el-Fitr", kind: "religious", hint: "Vœux, pause des promos agressives le jour J, reprise après." },
  { from: "2027-03-20", to: "2027-03-20", label: "Fête de l'indépendance", kind: "national" },
  { from: "2027-05-26", to: "2027-05-28", label: "Aïd el-Adha", kind: "religious", hint: "Vœux. Les contenus food/mouton sont attendus mais à doser." },
  { from: "2027-06-19", to: "2027-06-19", label: "Nouvel an hégirien", kind: "religious" },
  { from: "2027-07-15", to: "2027-08-31", label: "Soldes d'été TN", kind: "commercial", hint: "Peak conversion — pousse les contenus promo, UGC, témoignages." },
  { from: "2027-07-25", to: "2027-07-25", label: "Fête de la République", kind: "national" },
  { from: "2027-08-13", to: "2027-08-13", label: "Fête de la femme", kind: "national", hint: "Mets en avant les femmes de ton équipe ou de ta communauté." },
  { from: "2027-08-28", to: "2027-08-28", label: "Mouled", kind: "religious" },
  { from: "2027-09-15", to: "2027-09-15", label: "Rentrée scolaire", kind: "seasonal", hint: "Nouveau rythme — reprise de la cadence éditoriale, série « back to work »." },
  { from: "2027-10-15", to: "2027-10-15", label: "Fête de l'évacuation", kind: "national" },
];

const KIND_TONE: Record<MaghrebEvent["kind"], string> = {
  religious: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  national: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200",
  commercial: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  seasonal: "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200",
};

/** Événements qui tombent sur une date ISO (yyyy-mm-dd). */
export function eventsOnDate(iso: string): MaghrebEvent[] {
  return MAGHREB_EVENTS.filter((e) => iso >= e.from && iso <= e.to);
}

/** Classe Tailwind pour la pastille de la catégorie. */
export function eventTone(kind: MaghrebEvent["kind"]): string {
  return KIND_TONE[kind];
}
