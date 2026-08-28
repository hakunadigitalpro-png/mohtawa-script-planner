/* =========================================================================
   Le parcours d'accueil, page par page
   -------------------------------------------------------------------------
   Krea ne fait pas UNE visite guidée qu'on subit au premier jour : elle
   explique CHAQUE page la première fois qu'on y arrive, et se tait ensuite.
   C'est ce qui manquait à l'ancienne visite guidée — elle racontait tout
   d'un coup, hors contexte, donc rien ne restait.

   Règles d'écriture de ces bulles :
   - une seule idée par bulle, deux phrases maximum ;
   - on dit QUOI FAIRE, pas ce que la page « permet » ;
   - zéro jargon : ni « pilier », ni « KPI », ni « funnel » ;
   - on dit « contenus », jamais « vidéos » (il y a aussi des posts).
   ========================================================================= */

export type GuideStep = {
  /** Le texte de la bulle. Court : c'est une réplique, pas un paragraphe. */
  text: string;
  /** Étiquette du bouton si on veut autre chose que « Suivant ». */
  cta?: string;
};

export type GuidePage = {
  /** Identifiant stable — sert de clé de mémorisation « déjà vue ». */
  id: string;
  /** La page concernée, testée en préfixe sur l'URL. */
  match: (pathname: string) => boolean;
  steps: GuideStep[];
};

export const GUIDE_PAGES: GuidePage[] = [
  {
    id: "brand",
    match: (p) => /^\/brands\/[0-9a-f-]{36}/i.test(p),
    steps: [
      {
        text: "On commence ici. Tout ce que tu remplis sur cette page, je le réutilise partout ailleurs — tu ne le retaperas jamais deux fois.",
      },
      {
        text: "Fais ta stratégie de contenu en premier. Deux questions, et j'en déduis à qui tu parles, sur quel ton, et avec quels hashtags.",
      },
      {
        text: "Ensuite tes thèmes : les sujets dont tu parles. Demande-les-moi si tu ne sais pas par où commencer.",
        cta: "C'est parti",
      },
    ],
  },
  {
    id: "dashboard",
    match: (p) => p.startsWith("/dashboard"),
    steps: [
      {
        text: "Ton tableau de bord : ce que tu as en cours, ce qui arrive cette semaine, et ce qui marche.",
      },
      {
        text: "Pour créer un contenu, le bouton en haut à droite. Ou dis-le-moi simplement, je m'en occupe.",
        cta: "Compris",
      },
    ],
  },
  {
    id: "calendar",
    match: (p) => p.startsWith("/calendar"),
    steps: [
      {
        text: "Ton mois d'un coup d'œil. Attrape un contenu et glisse-le sur un autre jour pour le replanifier.",
      },
      {
        text: "Les boutons colorés en haut créent directement au bon format — reel, story, post…",
        cta: "Compris",
      },
    ],
  },
  {
    id: "content",
    match: (p) => p.startsWith("/content/"),
    steps: [
      {
        text: "Une fiche, un contenu. Les onglets suivent l'ordre du travail : le plan, le script, le storyboard, la préparation, puis les résultats.",
      },
      {
        text: "Le script, tu peux l'écrire toi-même ou me demander de le faire à partir de ton sujet.",
      },
      {
        text: "Le storyboard, ce sont tes plans dessinés avant de tourner. Un visuel par plan, et tu sais quoi filmer.",
        cta: "Compris",
      },
    ],
  },
  {
    id: "tasks",
    match: (p) => p.startsWith("/tasks"),
    steps: [
      {
        text: "Le tableau de ton équipe. Assigne une tâche, déplace-la quand elle avance, coche quand c'est fini.",
        cta: "Compris",
      },
    ],
  },
  {
    id: "analytics",
    match: (p) => p.startsWith("/analytics"),
    steps: [
      {
        text: "Ce qui marche vraiment, thème par thème. Remplis les résultats de tes contenus publiés et cette page se construit toute seule.",
        cta: "Compris",
      },
    ],
  },
  {
    id: "hooks",
    match: (p) => p.startsWith("/hooks"),
    steps: [
      {
        text: "70 accroches prêtes à l'emploi. Copie celle qui te parle, ou pioche-la directement depuis la fiche d'un contenu.",
        cta: "Compris",
      },
    ],
  },
];

export function guideForPath(pathname: string): GuidePage | null {
  return GUIDE_PAGES.find((g) => g.match(pathname)) ?? null;
}

/* ------------------------- Mémoire du « déjà vu » ------------------------- */

/**
 * Krea explique chaque écran UNE fois. On garde la liste des pages déjà vues
 * dans le navigateur, exposée en petit magasin externe : c'est ce qui permet
 * de la lire pendant le rendu (sans effet qui pilote un état) et de mettre
 * l'affichage à jour dès qu'on marque une page comme vue.
 *
 * Le rendu serveur répond « tout est vu » : sans ça, la bulle apparaîtrait
 * une fraction de seconde à chaque chargement, y compris sur les pages déjà
 * connues.
 */
const STORAGE_KEY = "krea_guide_seen";
const ALL_SEEN = "*";

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

function load(): Set<string> {
  if (cache) return cache;
  cache = new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) for (const id of JSON.parse(raw) as string[]) cache.add(id);
  } catch {
    // Navigation privée ou stockage bloqué : Krea réexpliquera, c'est tout.
  }
  return cache;
}

export function subscribeSeen(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Instantané stable (une chaîne) — exigé par `useSyncExternalStore`. */
export function seenSnapshot(): string {
  return [...load()].sort().join(",");
}

export function seenServerSnapshot(): string {
  return ALL_SEEN;
}

export function isSeen(snapshot: string, id: string): boolean {
  return snapshot === ALL_SEEN || snapshot.split(",").includes(id);
}

export function markSeen(id: string): void {
  const set = load();
  if (set.has(id)) return;
  set.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // idem : on n'empêche pas l'app de tourner pour une préférence d'affichage.
  }
  for (const l of listeners) l();
}
