/* =========================================================================
   Les visites guidées de Krea, page par page
   -------------------------------------------------------------------------
   Une visite = une suite d'étapes, chacune posée SUR un élément réel de la
   page (repéré par `data-tour="…"`). Krea ne décrit pas la page : elle
   montre où cliquer, dans l'ordre où on travaille — et le projecteur ne
   remonte jamais, l'ordre des étapes est l'ordre de la page.

   Chaque page a la sienne, jouée à la première visite de cette page et
   rejouable à tout moment. Pas de grand tour qui enchaîne tout d'un coup :
   l'ancienne visite racontait tout hors contexte, et rien ne restait.

   Règles d'écriture :
   - une idée par étape, deux phrases maximum ;
   - on dit QUOI FAIRE ici, pas ce que la page « permet » ;
   - on ne promet que ce que le code fait vraiment ;
   - zéro jargon ; « contenus », jamais « vidéos ».
   ========================================================================= */

export type TourStep = {
  /** La cible, par son attribut `data-tour`. Absente : bulle centrée. */
  target?: string;
  title: string;
  body: string;
};

export type Tour = {
  /** Identifiant stable — clé de mémorisation « déjà vue ». */
  id: string;
  match: (pathname: string) => boolean;
  /** `viewer` : la visite du client invité. Les autres : l'équipe. */
  audience: "team" | "viewer";
  steps: TourStep[];
};

export const TOURS: Tour[] = [
  {
    id: "brand",
    audience: "team",
    match: (p) => /^\/brands\/[0-9a-f-]{36}/i.test(p),
    steps: [
      {
        title: "Ta marque se met en place ici",
        body: "Tout ce que tu remplis sur cette page, je le réutilise partout : tu ne le retaperas jamais. Je te montre dans quel ordre.",
      },
      {
        target: "brand-strategy",
        title: "1 · Réponds à deux questions",
        body: "Ce que tu fais, pour qui, et ton objectif n°1. J'en déduis ton ton, ton audience et tes hashtags — c'est la base de tout ce que j'écris pour toi.",
      },
      {
        target: "brand-themes",
        title: "2 · Tes thèmes",
        body: "Les sujets dont tu parles, encore et encore. Demande-les-moi : je les propose à partir de ta stratégie, avec des exemples.",
      },
      {
        target: "brand-setups",
        title: "3 · Tes lieux de tournage",
        body: "Les quatre coins de ton bureau, ta cuisine, ta voiture… Décris-les une fois, tu les insères en un clic dans chaque storyboard.",
      },
      {
        target: "brand-identity",
        title: "4 · Ton logo",
        body: "Dépose-le ici : il s'affiche dans le menu, à côté du nom de ta marque, pour savoir d'un coup d'œil sur laquelle tu travailles.",
      },
      {
        target: "brand-team",
        title: "5 · Ton équipe et ton client",
        body: "Invite ceux qui travaillent avec toi. Ton client, invite-le en « client » : il ne verra que ce qu'il doit valider.",
      },
      {
        target: "brand-ai",
        title: "Et si tu préfères écrire toi-même",
        body: "Cet interrupteur coupe la génération de texte sur cette marque. Tout le reste continue de marcher.",
      },
    ],
  },
  {
    id: "dashboard",
    audience: "team",
    match: (p) => p.startsWith("/dashboard"),
    steps: [
      {
        target: "dashboard-kpis",
        title: "Où tu en es",
        body: "Ce que tu as en cours, ce qui est publié, ce qui arrive ce mois. Un coup d'œil suffit.",
      },
      {
        target: "dashboard-new",
        title: "Créer un contenu",
        body: "C'est ici. Ou dis-le-moi simplement — mon bouton est en bas de l'écran — et je le crée pour toi.",
      },
      {
        target: "dashboard-import",
        title: "Tu as déjà une liste de sujets ?",
        body: "Colle-la ici : chaque ligne devient un contenu — dans tes idées, ou déjà daté si tu donnes une date de départ.",
      },
    ],
  },
  {
    id: "calendar",
    audience: "team",
    match: (p) => p.startsWith("/calendar"),
    steps: [
      {
        target: "calendar-views",
        title: "Trois façons de voir ton mois",
        body: "Le calendrier pour placer, le planning pour lister, les idées pour ce qui n'a pas encore de date.",
      },
      {
        target: "calendar-new",
        title: "Nouveau contenu",
        body: "Choisis le format et la date. Sur ordinateur, tu peux aussi attraper un contenu du calendrier et le glisser sur un autre jour.",
      },
      {
        target: "calendar-grid",
        title: "Tes contenus, jour par jour",
        body: "La vignette, c'est sa première image. Clique un contenu pour ouvrir sa fiche.",
      },
    ],
  },
  {
    id: "content",
    audience: "team",
    match: (p) => p.startsWith("/content/"),
    steps: [
      {
        target: "content-tabs",
        title: "Les onglets suivent ton travail",
        body: "Le plan, puis le script ou les visuels, le storyboard, et la légende. Les performances apparaissent une fois publié.",
      },
      {
        target: "content-review",
        title: "Quand c'est prêt, envoie-le à ton client",
        body: "Il reçoit un e-mail, regarde, et valide ou laisse une remarque sur chaque visuel. Tu reçois un e-mail aussitôt.",
      },
      {
        target: "content-comments",
        title: "Les remarques arrivent ici",
        body: "Les tiennes, celles de ton équipe, celles de ton client. Tu réponds depuis là, il voit ta réponse.",
      },
    ],
  },
  {
    id: "tasks",
    audience: "team",
    match: (p) => p.startsWith("/tasks"),
    steps: [
      {
        target: "tasks-board",
        title: "Le tableau de ton équipe",
        body: "Une carte par tâche. Assigne-la, puis glisse-la quand elle avance, jusqu'à Terminé.",
      },
    ],
  },
  {
    id: "analytics",
    audience: "team",
    match: (p) => p.startsWith("/analytics"),
    steps: [
      {
        target: "analytics-kpis",
        title: "Ce qui marche vraiment",
        body: "Dès qu'un contenu est publié, sa fiche gagne un onglet Performances : note-y ses vues et ses likes. Cette page se remplit alors toute seule, thème par thème.",
      },
    ],
  },
  {
    id: "review",
    audience: "viewer",
    match: (p) => p.startsWith("/review"),
    steps: [
      {
        target: "review-visuals",
        title: "Regarde chaque visuel",
        body: "Sous chacun, un bouton pour laisser une remarque. Tu peux en laisser une par visuel, ou un mot sur l'ensemble.",
      },
      {
        target: "review-decision",
        title: "Puis réponds",
        body: "« Je valide » si c'est bon — tes remarques partent avec. « Je demande une modif' » si quelque chose doit changer.",
      },
    ],
  },
];

export function tourForPath(
  pathname: string,
  audience: Tour["audience"],
): Tour | null {
  return (
    TOURS.find((t) => t.audience === audience && t.match(pathname)) ?? null
  );
}

/* ------------------------- Mémoire du « déjà vue » ------------------------ */

/**
 * Chaque visite se joue UNE fois toute seule. La liste des visites déjà vues
 * vit dans le navigateur, exposée en petit magasin externe : lisible pendant
 * le rendu (sans effet qui pilote un état), et l'affichage se met à jour
 * dès qu'une visite est marquée vue.
 *
 * Le rendu serveur répond « tout est vu » : sinon la visite apparaîtrait une
 * fraction de seconde à chaque chargement, y compris sur une page connue.
 *
 * Les anciennes mémoires (bulles d'accueil, visite de la page de marque) ne
 * sont PAS héritées : ces visites sont un contenu nouveau, et ceux qui les
 * ont demandées doivent les voir. On efface les vieilles clés au passage.
 */
const STORAGE_KEY = "kreatly_tours_seen";
const STALE_KEYS = [
  "krea_guide_seen",
  "kreatly_tour_brand_v3",
  "mohtawa_tour_brand_v3",
];
const ALL_SEEN = "*";

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

function load(): Set<string> {
  if (cache) return cache;
  cache = new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) for (const id of JSON.parse(raw) as string[]) cache.add(id);
    for (const k of STALE_KEYS) localStorage.removeItem(k);
  } catch {
    // Navigation privée ou stockage bloqué : Krea réexpliquera, c'est tout.
  }
  return cache;
}

function persist(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // idem : une préférence d'affichage n'empêche pas l'app de tourner.
  }
  for (const l of listeners) l();
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
  persist(set);
}

/** « Rejouer toutes les visites » : pour une démo sur sa propre machine. */
export function forgetAllSeen(): void {
  const set = load();
  set.clear();
  persist(set);
}

/* --------------------------- Rejouer à la demande ------------------------- */

/**
 * « Fais-moi visiter cette page. » Le panneau de Krea le demande, la visite
 * (montée dans le layout) l'entend. Un compteur suffit : chaque demande
 * l'incrémente, et c'est son changement qui ouvre la visite — sans toucher
 * à la préférence « Krea me guide ».
 */
let requests = 0;
const requestListeners = new Set<() => void>();

export function requestTour(): void {
  requests += 1;
  for (const l of requestListeners) l();
}

export function subscribeRequests(onChange: () => void): () => void {
  requestListeners.add(onChange);
  return () => requestListeners.delete(onChange);
}

export function requestsSnapshot(): number {
  return requests;
}
