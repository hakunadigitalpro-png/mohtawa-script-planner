import {
  LayoutDashboard,
  CalendarDays,
  CheckCircle2,
  BarChart3,
  KanbanSquare,
  Building2,
  User,
  type LucideIcon,
} from "lucide-react";
import type { BrandRole } from "@/lib/brand";

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
  | "brands"
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
      { href: "/analytics", key: "analytics", icon: BarChart3 },
    ],
  },
  {
    key: "settings",
    items: [
      { href: "/brands", key: "brands", icon: Building2 },
      { href: "/profile", key: "profile", icon: User },
    ],
  },
];

/** Un « viewer » (client invité) est cantonné au Calendrier, à sa validation
 *  et à son profil — toutes les autres pages le renvoient au Calendrier. */
export function isVisibleFor(key: NavKey, role: BrandRole | null): boolean {
  if (role === "viewer") {
    return key === "calendar" || key === "review" || key === "profile";
  }
  // « À valider » est l'écran DU client : l'équipe envoie, elle n'y va pas
  // par le menu. (L'URL lui reste ouverte, et c'est voulu — la RPC
  // `client_review_content` autorise explicitement un membre à relire avant
  // le client, migration 0052.)
  return key !== "review";
}

/** Les groupes filtrés par rôle, les vides retirés. */
export function navSectionsFor(role: BrandRole | null): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => isVisibleFor(i.key, role)),
  })).filter((s) => s.items.length > 0);
}

/** À plat, dans l'ordre — ce dont la barre d'onglets mobile a besoin. */
export function navItemsFor(role: BrandRole | null): NavItem[] {
  return navSectionsFor(role).flatMap((s) => s.items);
}
