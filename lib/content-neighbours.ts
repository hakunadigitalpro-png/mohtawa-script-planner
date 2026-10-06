import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * D'où vient-on, et donc dans quoi enchaîne-t-on.
 *
 * Sans ça, « suivant » parcourt tous les contenus de la marque : on filtre le
 * calendrier sur mars et LinkedIn, on ouvre une carte, et la flèche emmène
 * dans un autre mois sur une autre plateforme. Le compte affiché ne
 * correspond alors à aucune liste qu'on a sous les yeux.
 */
export type NeighbourScope = {
  /** Mois affiché, au format AAAA-MM. */
  month?: string;
  platform?: string;
  /** Vrai quand on vient de l'onglet Idées : uniquement les contenus sans date. */
  undated?: boolean;
};

export type Neighbours = {
  prevId: string | null;
  nextId: string | null;
  /** Rang du contenu courant, à partir de 1. */
  position: number;
  total: number;
  /** Suffixe d'URL à propager pour que l'enchaînement garde le même périmètre. */
  query: string;
};

/** Reconstruit le périmètre depuis les paramètres d'URL de la fiche. */
export function scopeFromParams(
  params: Record<string, string | string[] | undefined>,
): NeighbourScope {
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;
  return {
    month: /^\d{4}-\d{2}$/.test(one(params.m) ?? "") ? one(params.m) : undefined,
    platform: one(params.platform),
    undated: one(params.scope) === "ideas",
  };
}

/** Le suffixe d'URL correspondant, pour que les flèches le transportent. */
export function scopeToQuery(scope: NeighbourScope): string {
  const parts: string[] = [];
  if (scope.undated) parts.push("scope=ideas");
  if (scope.month) parts.push(`m=${scope.month}`);
  if (scope.platform) parts.push(`platform=${encodeURIComponent(scope.platform)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Le contenu précédent et le suivant, dans l'ordre de la liste d'où l'on vient.
 *
 * Pourquoi : on traite ses contenus par lots — relire les carrousels d'un
 * atelier, compléter les scripts d'une série. Revenir à la liste entre chaque,
 * retrouver la ligne, recliquer : c'est le geste qu'on répète le plus et le
 * seul qui n'apporte rien.
 *
 * L'ordre reprend celui du Planning — la date d'abord, la création ensuite —
 * pour que « suivant » mène là où l'œil l'attend.
 */
export async function fetchNeighbours(
  supabase: Supabase,
  brandId: string,
  currentId: string,
  scope: NeighbourScope = {},
): Promise<Neighbours> {
  const query = scopeToQuery(scope);

  // Une seule requête, sur les identifiants : la liste d'une marque reste
  // légère, et c'est la seule façon d'avoir un rang exact sans compter à part.
  let q = supabase.from("contents").select("id").eq("brand_id", brandId);

  if (scope.undated) {
    q = q.is("date", null);
  } else if (scope.month) {
    const [y, m] = scope.month.split("-").map(Number);
    const next = new Date(y, m, 1);
    q = q
      .gte("date", `${scope.month}-01`)
      .lt(
        "date",
        `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`,
      );
  }
  // La plateforme vit sur `contents.platform`, colonne resynchronisée par le
  // trigger depuis la publication primaire (0020) : elle suffit ici, où l'on
  // ne cherche qu'un ordre de parcours.
  if (scope.platform) q = q.eq("platform", scope.platform);

  const { data } = await q
    .order("date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  const at = ids.indexOf(currentId);

  // Hors périmètre — on a filtré sur mars et ouvert un contenu d'avril par un
  // lien direct. Mieux vaut ne rien afficher qu'un rang faux.
  if (at === -1) {
    return { prevId: null, nextId: null, position: 0, total: 0, query };
  }
  return {
    prevId: at > 0 ? ids[at - 1] : null,
    nextId: at < ids.length - 1 ? ids[at + 1] : null,
    position: at + 1,
    total: ids.length,
    query,
  };
}
