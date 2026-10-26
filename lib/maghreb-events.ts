/**
 * Marqueurs des temps forts du calendrier Maghreb : Tunisie, Maroc,
 * Algérie. L'utilisateur active ou désactive les pays depuis le
 * calendrier (préférence en cookie `kreatly_countries`).
 *
 * Trois usages :
 *  - afficher une pastille sur le PREMIER jour de l'événement
 *    (plus de pastille répétée sur une période de 2 mois de soldes)
 *  - suggérer un pilier pertinent (ex. Ramadan → bien-être)
 *  - alimenter plus tard les suggestions de bulk-génération IA
 *
 * Dates hégiriennes converties en grégorien pour 2026 et 2027. Les
 * fêtes nationales et religieuses sont partagées entre les trois pays,
 * mais le `country` dit à qui elles comptent en premier.
 */

export type EventCountry = "TN" | "MA" | "DZ" | "ALL";

export type MaghrebEvent = {
  /** Première date couverte (ISO yyyy-mm-dd) — c'est celle qui porte la pastille. */
  from: string;
  /** Dernière date, incluse. Égale à `from` pour un jour unique. */
  to: string;
  /** Nom court montré dans la case. */
  label: string;
  /** Catégorie, pour la couleur de la pastille. */
  kind: "religious" | "national" | "commercial" | "seasonal";
  /** Pays concerné. "ALL" = partagé (Ramadan, Aïd…). */
  country: EventCountry;
  /** Suggestion de ton éditorial, lue en infobulle. */
  hint?: string;
};

export const COUNTRY_LABELS: Record<Exclude<EventCountry, "ALL">, string> = {
  TN: "Tunisie",
  MA: "Maroc",
  DZ: "Algérie",
};

export const DEFAULT_COUNTRIES: Exclude<EventCountry, "ALL">[] = ["TN"];

export const MAGHREB_EVENTS: MaghrebEvent[] = [
  // 2026
  { from: "2026-10-26", to: "2026-10-26", label: "Mouled", kind: "religious", country: "ALL", hint: "Mawlid an-Nabawi — ton respectueux, pas de promo agressive." },
  { from: "2026-11-01", to: "2026-11-01", label: "Révolution DZ", kind: "national", country: "DZ" },
  { from: "2026-11-06", to: "2026-11-06", label: "Marche Verte", kind: "national", country: "MA" },
  { from: "2026-11-15", to: "2026-11-15", label: "Évacuation TN", kind: "national", country: "TN" },
  { from: "2026-11-18", to: "2026-11-18", label: "Indépendance MA", kind: "national", country: "MA" },
  { from: "2026-12-20", to: "2027-02-15", label: "Soldes d'hiver TN", kind: "commercial", country: "TN", hint: "Peak conversion : contenus réduction, codes promo, cross-sell." },

  // 2027
  { from: "2027-01-11", to: "2027-01-11", label: "Manifeste indépendance MA", kind: "national", country: "MA" },
  { from: "2027-01-12", to: "2027-01-12", label: "Yennayer DZ", kind: "national", country: "DZ", hint: "Nouvel an berbère — contenus culture, cuisine amazigh." },
  { from: "2027-01-14", to: "2027-01-14", label: "Révolution TN", kind: "national", country: "TN" },
  { from: "2027-02-17", to: "2027-03-18", label: "Ramadan", kind: "religious", country: "ALL", hint: "Horaire décalé (publier le soir), ton bienveillant, contenus bien-être / cuisine / famille." },
  { from: "2027-03-19", to: "2027-03-21", label: "Aïd el-Fitr", kind: "religious", country: "ALL", hint: "Vœux, pause des promos agressives le jour J, reprise après." },
  { from: "2027-03-20", to: "2027-03-20", label: "Indépendance TN", kind: "national", country: "TN" },
  { from: "2027-05-01", to: "2027-05-01", label: "Fête du travail", kind: "national", country: "ALL" },
  { from: "2027-05-26", to: "2027-05-28", label: "Aïd el-Adha", kind: "religious", country: "ALL", hint: "Vœux. Les contenus food/mouton sont attendus mais à doser." },
  { from: "2027-06-19", to: "2027-06-19", label: "Nouvel an hégirien", kind: "religious", country: "ALL" },
  { from: "2027-07-05", to: "2027-07-05", label: "Indépendance DZ", kind: "national", country: "DZ" },
  { from: "2027-07-15", to: "2027-08-31", label: "Soldes d'été TN", kind: "commercial", country: "TN", hint: "Peak conversion — pousse les contenus promo, UGC, témoignages." },
  { from: "2027-07-25", to: "2027-07-25", label: "République TN", kind: "national", country: "TN" },
  { from: "2027-07-30", to: "2027-07-30", label: "Fête du Trône MA", kind: "national", country: "MA" },
  { from: "2027-08-13", to: "2027-08-13", label: "Fête de la femme TN", kind: "national", country: "TN", hint: "Mets en avant les femmes de ton équipe ou de ta communauté." },
  { from: "2027-08-20", to: "2027-08-20", label: "Révolution Roi et Peuple MA", kind: "national", country: "MA" },
  { from: "2027-08-28", to: "2027-08-28", label: "Mouled", kind: "religious", country: "ALL" },
  { from: "2027-09-15", to: "2027-09-15", label: "Rentrée scolaire", kind: "seasonal", country: "ALL", hint: "Nouveau rythme — reprise de la cadence éditoriale, série « back to work »." },
  { from: "2027-10-15", to: "2027-10-15", label: "Évacuation TN", kind: "national", country: "TN" },
  { from: "2027-11-01", to: "2027-11-01", label: "Révolution DZ", kind: "national", country: "DZ" },
  { from: "2027-11-06", to: "2027-11-06", label: "Marche Verte", kind: "national", country: "MA" },
  { from: "2027-11-18", to: "2027-11-18", label: "Indépendance MA", kind: "national", country: "MA" },
];

/**
 * Texte foncé fixe (foreground) sur fond pastel : le benchmark des cartes
 * de la fiche campagne a montré que `text-emerald-900` passait sous le
 * `text-muted-foreground` hérité des parents. On force la couleur ici,
 * c'est le plus simple et le plus robuste.
 */
const KIND_TONE: Record<MaghrebEvent["kind"], string> = {
  religious: "bg-emerald-200 !text-emerald-950 dark:bg-emerald-500/40 dark:!text-emerald-50",
  national: "bg-sky-200 !text-sky-950 dark:bg-sky-500/40 dark:!text-sky-50",
  commercial: "bg-amber-200 !text-amber-950 dark:bg-amber-500/40 dark:!text-amber-50",
  seasonal: "bg-violet-200 !text-violet-950 dark:bg-violet-500/40 dark:!text-violet-50",
};

/** Événements dont le PREMIER JOUR tombe sur cette date (ISO yyyy-mm-dd). */
export function eventsStartingOnDate(
  iso: string,
  countries: Exclude<EventCountry, "ALL">[] = DEFAULT_COUNTRIES,
): MaghrebEvent[] {
  const active = new Set<EventCountry>([...countries, "ALL"]);
  return MAGHREB_EVENTS.filter((e) => e.from === iso && active.has(e.country));
}

/** Classe Tailwind pour la pastille de la catégorie. */
export function eventTone(kind: MaghrebEvent["kind"]): string {
  return KIND_TONE[kind];
}
