import type { BrandRole } from "@/lib/brand";

/**
 * La liste des modules que Mariam peut ouvrir ou fermer par personne,
 * et la seule. Ce fichier est partagé entre le serveur (gardes de
 * routes, filtrage sidebar), la base (la clé stockée dans
 * `brand_members.scopes`) et l'UI (pastilles de la page Équipe).
 *
 * Volontairement 8 modules « gros », pas des permissions fines
 * read / write : la granularité fine n'apportait rien à notre cible
 * (patronne de PME) et le gestionnaire d'accès serait devenu une
 * grille à 24 cases par membre. Un membre a accès à un module ou pas,
 * et quand il y a accès c'est en lecture + écriture selon son rôle.
 */
export type ScopeKey =
  | "contents"
  | "ads"
  | "tasks"
  | "analytics"
  | "review"
  | "ai"
  | "brand_settings"
  | "team";

export const SCOPES: { key: ScopeKey; label: string; hint: string }[] = [
  { key: "contents", label: "Contenus", hint: "Calendrier, planning, kanban, fiches contenu, idées" },
  { key: "ads", label: "Publicités", hint: "Campagnes, ad sets, ads" },
  { key: "tasks", label: "Tâches", hint: "Le kanban de l'équipe" },
  { key: "analytics", label: "Analytics", hint: "Résultats et performances" },
  { key: "review", label: "Validation client", hint: "Page /review" },
  { key: "ai", label: "IA", hint: "Boutons de génération (consomment des tokens)" },
  { key: "brand_settings", label: "Marque", hint: "Logo, stratégie, piliers, thèmes" },
  { key: "team", label: "Équipe", hint: "Inviter, retirer, changer les rôles" },
];

/**
 * Les scopes auxquels un rôle a droit PAR DÉFAUT, quand `scopes = NULL`
 * (pas de personnalisation). Cette table est la vérité : elle est
 * reproduite côté base dans `has_brand_scope(b, s)` (migration 0082).
 */
const ROLE_DEFAULTS: Record<BrandRole, ScopeKey[]> = {
  owner: ["contents", "ads", "tasks", "analytics", "review", "ai", "brand_settings", "team"],
  admin: ["contents", "ads", "tasks", "analytics", "review", "ai", "brand_settings", "team"],
  // Editor simple : pas d'IA (c'est Mariam qui paie les tokens, opt-in).
  editor: ["contents", "ads", "tasks", "analytics", "review"],
  // Editor IA : exactement comme editor + IA activée.
  editor_ai: ["contents", "ads", "tasks", "analytics", "review", "ai"],
  // Le client voit review + les publicités (pour valider les créas).
  viewer: ["review", "ads"],
};

/** Les scopes effectifs d'un membre : la liste posée ou le défaut du rôle. */
export function effectiveScopes(
  role: BrandRole,
  scopes: string[] | null | undefined,
): ScopeKey[] {
  if (scopes != null) {
    return scopes.filter((s): s is ScopeKey =>
      SCOPES.some((o) => o.key === s),
    );
  }
  return [...ROLE_DEFAULTS[role]];
}

/** Un membre a-t-il tel scope ? Shortcut sur `effectiveScopes`. */
export function hasScope(
  role: BrandRole,
  scopes: string[] | null | undefined,
  s: ScopeKey,
): boolean {
  return effectiveScopes(role, scopes).includes(s);
}
