/**
 * Menu large (libellés visibles) ou rail d'icônes.
 *
 * En cookie et pas en `localStorage`, pour la même raison que le thème : il
 * est lu côté serveur, donc le HTML arrive déjà dans le bon état. Stocké en
 * `localStorage`, le menu s'afficherait large puis se replierait sous les
 * yeux à chaque chargement.
 *
 * Ce fichier est lu des DEUX côtés — le menu (client) écrit le cookie, le
 * layout (serveur) le relit. `next/headers` n'est donc pas importé en tête :
 * il ferait basculer tout le module côté serveur et casserait le bundle
 * client. Il est chargé à la demande, dans la seule fonction qui en a besoin.
 */
export const NAV_COOKIE = "kreatly_nav";

export type NavMode = "wide" | "rail";

export function isNavMode(v: string | undefined | null): v is NavMode {
  return v === "wide" || v === "rail";
}

/** Large par défaut : un menu qui s'explique vaut mieux qu'un menu à deviner. */
export async function getNavMode(): Promise<NavMode> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const raw = store.get(NAV_COOKIE)?.value;
  return isNavMode(raw) ? raw : "wide";
}
