import {
  LayoutDashboard,
  CalendarDays,
  CheckCircle2,
  BarChart3,
  KanbanSquare,
  Megaphone,
  Building2,
  Users,
  User,
  type LucideIcon,
} from "lucide-react";
import type { BrandRole } from "@/lib/brand";
import type { ScopeKey } from "@/lib/scopes";

/**
 * LA liste des entrées de menu, et la seule.
 *
 * Elle était écrite deux fois — `components/sidebar.tsx` et
 * `components/mobile-nav.tsx` — avec la règle du rôle `viewer` recopiée aux
 * deux endroits. Deux vérités pour une seule navigation : le jour où une
 * entrée bouge, le mobile dérive en silence.
 *
 * Les deux rendus restent libres : le menu latéral affiche les groupes et
 * leurs titres, la barre d'onglets mobile ignore le groupe et ne garde que
 * ses cinq premiers onglets.
 */

export type NavKey =
  | "dashboard"
  | "calendar"
  | "review"
  | "analytics"
  | "tasks"
  | "ads"
  | "brands"
  | "team"
  | "profile";

export type NavSectionKey = "main" | "settings";

export type NavItem = { href: string; key: NavKey; icon: LucideIcon };

export type NavSection = { key: NavSectionKey; items: NavItem[] };

/**
 * Deux groupes, nommés par ce qu'on y fait.
 *
 * `main` — le travail : je regarde où j'en suis, je planifie, je suis les
 * tâches de l'équipe, je mesure. C'est la boucle du produit (Idée → Mesure →
 * Amélioration) : les chiffres servent à décider le mois suivant, ils n'ont
 * rien à faire dans un tiroir « avancé ».
 * `settings` — « Mon espace », pas « Réglages » : la page d'une marque est
 * son studio (piliers, objectifs, équipe, stratégie, interrupteur IA), pas
 * un panneau de configuration.
 *
 * Il y avait un troisième groupe, « Production », avec les tâches et la
 * bibliothèque d'accroches. La bibliothèque a été retirée (70 phrases figées
 * n'ont plus de sens quand Krea écrit l'accroche à partir du sujet), et un
 * titre pour une seule entrée est pire que pas de titre.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "main",
    items: [
      { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
      { href: "/calendar", key: "calendar", icon: CalendarDays },
      { href: "/review", key: "review", icon: CheckCircle2 },
      { href: "/tasks", key: "tasks", icon: KanbanSquare },
      { href: "/ads", key: "ads", icon: Megaphone },
      { href: "/analytics", key: "analytics", icon: BarChart3 },
    ],
  },
  {
    key: "settings",
    items: [
      { href: "/brands", key: "brands", icon: Building2 },
      { href: "/team", key: "team", icon: Users },
      { href: "/profile", key: "profile", icon: User },
    ],
  },
];

/** Mapping entrée de menu → scope requis. `null` = entrée toujours
 *  visible (dashboard, profil et marques restent accessibles à tout
 *  membre). `review` reste réservé au client invité (viewer). */
const NAV_SCOPE_REQUIRED: Record<NavKey, ScopeKey | null> = {
  dashboard: null,
  calendar: "contents",
  review: "review",
  tasks: "tasks",
  ads: "ads",
  analytics: "analytics",
  brands: null,
  // L'entrée « Équipe » n'apparaît que pour un membre qui a le scope
  // 'team' sur la marque active. Un editor n'y a pas accès par défaut
  // ni un viewer — seuls owner/admin.
  team: "team",
  profile: null,
};

/** Une entrée est visible si :
 *   - l'user a le scope requis (ou aucun scope n'est requis)
 *   - cas particulier : « À valider » reste l'écran DU client (viewer).
 */
export function isVisibleFor(
  key: NavKey,
  role: BrandRole | null,
  scopes: readonly string[] | null = null,
): boolean {
  const required = NAV_SCOPE_REQUIRED[key];

  // « À valider » : réservé au viewer (le client), masqué pour l'équipe.
  if (key === "review") return role === "viewer";

  if (required === null) {
    // Un viewer ne voit QUE review + profil (dashboard et brands ne lui
    // apportent rien, et son unique point d'entrée reste /review).
    if (role === "viewer") return key === "profile";
    return true;
  }

  // Scopes posés : on les respecte à la lettre.
  if (scopes && scopes.length > 0) {
    return scopes.includes(required);
  }

  // Pas de scopes passés (ex. SSR qui ne les a pas chargés) : on
  // retombe sur le défaut rôle, pour ne jamais rien cacher par erreur.
  if (role === "viewer") return required === "review";
  return true;
}

/** Les groupes filtrés par rôle et scopes. */
export function navSectionsFor(
  role: BrandRole | null,
  scopes: readonly string[] | null = null,
): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => isVisibleFor(i.key, role, scopes)),
  })).filter((s) => s.items.length > 0);
}

/** À plat, dans l'ordre — ce dont la barre d'onglets mobile a besoin. */
export function navItemsFor(
  role: BrandRole | null,
  scopes: readonly string[] | null = null,
): NavItem[] {
  return navSectionsFor(role, scopes).flatMap((s) => s.items);
}
