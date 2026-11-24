export const CONTENT_TYPES = [
  { value: "reel", label: "Reel", color: "var(--color-reel)" },
  { value: "story", label: "Story", color: "var(--color-story)" },
  { value: "vlog", label: "Vlog", color: "var(--color-vlog)" },
  { value: "post", label: "Post", color: "var(--color-post)" },
  { value: "carousel", label: "Carrousel", color: "var(--color-carousel)" },
  { value: "infographic", label: "Infographie", color: "var(--color-infographic)" },
  { value: "long_video", label: "Vidéo longue", color: "var(--color-long-video)" },
  // « Direct », pas « Live » : « Live » est déjà le statut « c'est sorti ».
  { value: "livestream", label: "Direct", color: "var(--color-livestream)" },
  { value: "podcast", label: "Podcast", color: "var(--color-podcast)" },
  { value: "article", label: "Article", color: "var(--color-article)" },
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number]["value"];

/**
 * Ce que chaque format SAIT FAIRE — la seule table à remplir pour en ajouter
 * un. `isSimpleType` portait à lui seul trois décisions (le mot de l'étape
 * d'écriture, le tournage, le mot « programmé ») : un format oublié tombait
 * en silence dans la famille vidéo.
 */
type FormatSpec = {
  /** Où le format se range dans les menus. */
  group: "short" | "long" | "visual";
  /** Suit les statuts Design → Programmé (SIMPLE_STATUSES) plutôt que la vidéo. */
  simple: boolean;
  /** Passe par Tournage et Montage. Un direct se prépare, il ne se monte pas. */
  filmed: boolean;
  /** Le lecteur vidéo s'affiche en 16:9 plutôt qu'en vertical. */
  wide: boolean;
};

const FORMAT_SPECS: Record<ContentType, FormatSpec> = {
  reel: { group: "short", simple: false, filmed: true, wide: false },
  story: { group: "short", simple: false, filmed: true, wide: false },
  vlog: { group: "short", simple: false, filmed: true, wide: false },
  long_video: { group: "long", simple: false, filmed: true, wide: true },
  livestream: { group: "long", simple: false, filmed: false, wide: true },
  podcast: { group: "long", simple: false, filmed: true, wide: true },
  article: { group: "long", simple: true, filmed: false, wide: true },
  post: { group: "visual", simple: true, filmed: false, wide: false },
  carousel: { group: "visual", simple: true, filmed: false, wide: false },
  infographic: { group: "visual", simple: true, filmed: false, wide: false },
};

function specOf(type: string | null | undefined): FormatSpec | null {
  return (FORMAT_SPECS as Record<string, FormatSpec>)[type ?? ""] ?? null;
}

/** Suit les statuts « simples » (Design, Programmé) : post, carrousel,
 *  infographie — et article, qui se rédige sans se tourner. */
export function isSimpleType(type: string | null | undefined): boolean {
  return specOf(type)?.simple ?? false;
}

/** Passe par Tournage et Montage. */
export function isFilmedType(type: string | null | undefined): boolean {
  return specOf(type)?.filmed ?? false;
}

/** S'écrit en parties (chapitres, déroulé, intertitres), et on en tire des
 *  contenus courts : vidéo longue, direct, podcast, article. */
export function isLongformType(type: string | null | undefined): boolean {
  return specOf(type)?.group === "long";
}

/** Le lecteur vidéo s'affiche en 16:9 plutôt qu'en vertical. */
export function isWideType(type: string | null | undefined): boolean {
  return specOf(type)?.wide ?? false;
}

/** L'onglet où l'on arrive depuis le calendrier ou le planning. */
export function mainTabForType(type: string | null | undefined): string {
  if (isLongformType(type)) return "parts";
  return !type || isSimpleType(type) ? "content" : "video";
}

/** L'onglet où s'écrit la légende de ce format. */
export function captionTabForType(type: string | null | undefined): string {
  return isLongformType(type) || isSimpleType(type) ? "content" : "caption";
}

const FORMAT_GROUPS: { key: FormatSpec["group"]; label: string }[] = [
  { key: "short", label: "Vidéo courte" },
  { key: "long", label: "Format long" },
  { key: "visual", label: "Visuel" },
];

/** Les formats rangés par famille, pour les menus : dix à plat ne se lisent pas. */
export const GROUPED_CONTENT_TYPES = FORMAT_GROUPS.flatMap((g) =>
  (Object.keys(FORMAT_SPECS) as ContentType[])
    .filter((t) => FORMAT_SPECS[t].group === g.key)
    .map((t) => ({
      ...CONTENT_TYPES.find((c) => c.value === t)!,
      group: g.label,
    })),
);

/** Une phrase pour les formats qu'on ne connaît pas forcément. */
export const FORMAT_HINTS: Partial<Record<ContentType, string>> = {
  long_video: "Une vidéo YouTube de plusieurs minutes, écrite en chapitres.",
  livestream: "Un direct à une heure précise, avec son déroulé.",
  podcast: "Un épisode : l'invité, les questions, puis les extraits à publier.",
  article: "Un texte pour ton site, ta newsletter ou LinkedIn.",
};

export const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "spotify", label: "Spotify" },
  { value: "website", label: "Site / blog" },
  { value: "email", label: "E-mail" },
] as const;

export type Platform = (typeof PLATFORMS)[number]["value"];

const PLATFORMS_BY_TYPE: Record<string, Platform[]> = {
  reel: ["instagram", "tiktok", "youtube", "facebook", "linkedin"],
  story: ["instagram", "tiktok"],
  vlog: ["instagram", "tiktok", "youtube", "facebook"],
  post: ["instagram", "facebook", "linkedin"],
  carousel: ["instagram", "linkedin", "facebook", "tiktok"],
  infographic: ["instagram", "linkedin", "facebook"],
  long_video: ["youtube", "facebook", "linkedin"],
  livestream: ["instagram", "facebook", "youtube", "tiktok", "linkedin"],
  podcast: ["spotify", "youtube", "website", "facebook", "linkedin"],
  // Un seul format pour l'article et la newsletter : même texte, deux sorties.
  article: ["website", "email", "linkedin"],
};

export function platformsForType(type: string | null | undefined) {
  const allowed = PLATFORMS_BY_TYPE[type ?? ""] ?? [];
  return PLATFORMS.filter((p) => allowed.includes(p.value));
}

/**
 * Statuts des types "vidéo" (reel/story/vlog) — production pas à pas.
 * "approved" et "live" sont volontairement les MÊMES valeurs que sur
 * SIMPLE_STATUSES (même vocabulaire pour "prêt à programmer" et "sorti"),
 * pour que la nouvelle notification "validé mais pas programmé" et le
 * passage automatique en Live (recompute_live_statuses) marchent pareil
 * quel que soit le format du contenu.
 */
export const STATUSES = [
  { value: "idea", label: "Idée", color: "var(--color-status-idea)" },
  // « Retenue » (`selected`) existe en base pour le board des idées mais ne
  // paraît plus dans le menu Statut d'un contenu qui a déjà un format : à
  // ce stade on sait déjà où elle va, le mot n'ajoutait rien. Les quelques
  // lignes historiques en « selected » restent lisibles via IDEA_STATUSES.
  { value: "script", label: "Script", color: "var(--color-status-script)" },
  { value: "filming", label: "Tournage", color: "var(--color-status-filming)" },
  { value: "editing", label: "Montage", color: "var(--color-status-editing)" },
  { value: "approved", label: "Validé", color: "var(--color-status-approved)" },
  { value: "scheduled", label: "Programmée", color: "var(--color-status-scheduled)" },
  { value: "live", label: "Live", color: "var(--color-status-live)" },
] as const;

/**
 * Statuts des types "simples" (post/carrousel/infographie) — workflow de
 * design + validation d'équipe, différent de la production vidéo. "live"
 * remplace "published" : calculé automatiquement une fois la date+heure de
 * publication dépassée (RPC `recompute_live_statuses`, migration 0041), pas
 * besoin de le cocher à la main comme pour une vidéo.
 */
export const SIMPLE_STATUSES = [
  { value: "idea", label: "Idée", color: "var(--color-status-idea)" },
  // « Retenue » retirée du menu Statut (voir STATUSES ci-dessus).
  { value: "design", label: "Design", color: "var(--color-status-design)" },
  {
    value: "pending_review",
    label: "En attente de validation",
    color: "var(--color-status-pending-review)",
  },
  {
    value: "needs_revision",
    label: "À réviser",
    color: "var(--color-status-needs-revision)",
  },
  { value: "approved", label: "Validé", color: "var(--color-status-approved)" },
  { value: "programmed", label: "Programmé", color: "var(--color-status-scheduled)" },
  { value: "live", label: "Live", color: "var(--color-status-live)" },
] as const;

/**
 * Liste de statuts adaptée au type de contenu (vidéo vs simple).
 *
 * Sans format — une idée pas encore traitée — on ne propose QUE les deux
 * étapes communes aux deux parcours. Proposer « Tournage » ou « Montage »
 * à quelque chose dont on ignore encore si ce sera une vidéo n'aurait aucun
 * sens : c'est le choix du format qui ouvre la suite.
 */
export function statusesForType(type: string | null | undefined) {
  const steps = !type ? IDEA_STATUSES : isSimpleType(type) ? SIMPLE_STATUSES : STATUSES;
  return [...steps, CANCELLED_STATUS]
    .filter((s) => !type || isFilmedType(type) || !FILMING_STATUSES.has(s.value))
    .map((s) => ({ ...s, label: statusWord(s.value, type) ?? s.label }));
}

const FILMING_STATUSES = new Set<string>(["filming", "editing"]);

/**
 * Le mot juste pour CE format : on rédige un article, on enregistre un
 * podcast, on prépare un direct. Projection d'affichage — la valeur en base
 * reste la même, comme pour `clientStatusLabel`. Null : le mot habituel va.
 */
function statusWord(
  status: string | null | undefined,
  type: string | null | undefined,
): string | null {
  return STATUS_WORDS[statusKey(status, type)] ?? null;
}

const STATUS_WORDS: Record<string, string> = {
  design_article: "Rédaction",
  filming_podcast: "Enregistrement",
  script_livestream: "Préparation",
};

/** La clé de traduction (`messages/*.json`, `statuses`) de ce statut sur ce format. */
export function statusKey(
  status: string | null | undefined,
  type: string | null | undefined,
): string {
  const key = `${status}_${type}`;
  return key in STATUS_WORDS ? key : (status ?? "");
}

/**
 * Abandonner sans supprimer (0094). Hors de la ligne de temps : ce n'est pas
 * une étape, donc il reste en dehors des trois listes ci-dessus, dont les
 * étapes servent aussi de colonnes (board des idées).
 */
export const CANCELLED_STATUS = {
  value: "cancelled",
  label: "Annulé",
  color: "var(--color-status-cancelled)",
} as const;

export function isCancelled(status: string | null | undefined) {
  return status === "cancelled";
}

/** Les seuls statuts qu'un contenu sans format peut porter. */
export const IDEA_STATUSES = [
  { value: "idea", label: "Idée", color: "var(--color-status-idea)" },
  {
    value: "selected",
    label: "Retenue",
    color: "var(--color-status-selected)",
  },
] as const;

/** Union dédupliquée des trois listes — pour un filtre global (dashboard)
 *  et pour que `statusLabel("selected")` continue de rendre « Retenue »
 *  même si cette étape n'est plus proposée dans le menu Statut. */
export const ALL_STATUSES = [
  ...STATUSES,
  ...SIMPLE_STATUSES,
  ...IDEA_STATUSES,
  CANCELLED_STATUS,
].filter((s, i, arr) => arr.findIndex((s2) => s2.value === s.value) === i);

export type Status = (typeof STATUSES)[number]["value"];

export const OBJECTIVES = [
  { value: "education", label: "Éducation" },
  { value: "personal_brand", label: "Personal Brand" },
  { value: "sales", label: "Vente" },
  { value: "awareness", label: "Notoriété" },
  { value: "engagement", label: "Engagement" },
] as const;

export const SCENE_TAGS = [
  { value: "hook", label: "Accroche" },
  { value: "content", label: "Contenu" },
  { value: "transition", label: "Transition" },
  { value: "cta", label: "CTA" },
] as const;

export const STORY_SLOT_LABELS: Record<number, string> = {
  1: "Title / Introduction",
  2: "Story 2",
  3: "Story 3",
  4: "Story 4",
  5: "Call to Action",
};

export function typeColor(type: string | null | undefined) {
  return CONTENT_TYPES.find((t) => t.value === type)?.color ?? "#6b7280";
}
export function typeLabel(type: string | null | undefined) {
  return CONTENT_TYPES.find((t) => t.value === type)?.label ?? type ?? "—";
}
export function statusColor(status: string | null | undefined) {
  return ALL_STATUSES.find((s) => s.value === status)?.color ?? "#6b7280";
}
export function statusLabel(
  status: string | null | undefined,
  type?: string | null,
) {
  const word = statusWord(status, type);
  if (word) return word;
  return ALL_STATUSES.find((s) => s.value === status)?.label ?? status ?? "—";
}

/**
 * Les 12 statuts internes, projetés en 5 mots qu'un client comprend.
 *
 * C'est une PROJECTION D'AFFICHAGE, pas un second jeu de valeurs : rien de
 * nouveau n'est stocké. Inventer des valeurs ici les ferait rejeter par la
 * contrainte `contents_status_check` (migration 0042), exactement le bug
 * qui empêchait l'onglet Plan d'enregistrer.
 *
 * Un client n'a pas à savoir si on en est au tournage ou au montage : de
 * son point de vue c'est « en préparation » tant qu'on ne lui demande rien.
 * Il distingue en revanche ce qu'il a validé de ce qui est déjà sorti.
 */
const CLIENT_STATUS: Record<string, string> = {
  pending_review: "À valider",
  needs_revision: "Modifications demandées",
  approved: "Validé",
  scheduled: "Validé",
  programmed: "Validé",
  live: "Publié",
  published: "Publié",
  cancelled: "Annulé",
};

export function clientStatusLabel(status: string | null | undefined) {
  return CLIENT_STATUS[status ?? ""] ?? "En préparation";
}

/** Couleur de la pastille côté client — alignée sur la projection ci-dessus. */
export function clientStatusColor(status: string | null | undefined) {
  if (status === "pending_review" || status === "needs_revision") {
    return statusColor(status);
  }
  if (status === "live" || status === "published") return statusColor("live");
  if (status === "cancelled") return statusColor("cancelled");
  if (CLIENT_STATUS[status ?? ""]) return statusColor("approved");
  return statusColor("idea");
}

/** Le contenu attend une décision du client. */
export function isAwaitingClient(status: string | null | undefined) {
  return status === "pending_review";
}

/**
 * "C'est sorti" pour n'importe quel type de contenu. "live" est la valeur
 * courante (vidéo comme post/carrousel/infographie) ; "published" reste
 * accepté en legacy pour la fenêtre entre un déploiement de code et
 * l'exécution manuelle de la migration qui bascule les anciennes vidéos
 * "published" vers "live" (migration 0045).
 */
export function isLiveStatus(status: string | null | undefined) {
  return status === "live" || status === "published";
}
export function platformLabel(platform: string | null | undefined) {
  return PLATFORMS.find((p) => p.value === platform)?.label ?? platform ?? "—";
}

/**
 * Un NOM de marque, pas une description : au-dela il se coupe dans le menu,
 * le selecteur et les e-mails. Partage entre la validation serveur et les
 * champs de saisie (maxLength), pour que les deux disent la meme chose.
 */
export const BRAND_NAME_MAX = 40;
