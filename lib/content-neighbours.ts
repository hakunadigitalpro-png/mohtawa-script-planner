import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Neighbours = {
  prevId: string | null;
  nextId: string | null;
  /** Rang du contenu courant, à partir de 1. */
  position: number;
  total: number;
};

/**
 * Le contenu précédent et le suivant, dans l'ordre où ils apparaissent au
 * planning.
 *
 * Pourquoi : on traite ses contenus par lots — relire quinze carrousets d'un
 * atelier, compléter les scripts d'une série. Revenir au calendrier entre
 * chaque, retrouver la case, recliquer : c'est le geste qu'on répète le plus
 * et le seul qui n'apporte rien.
 *
 * L'ordre reprend celui du Planning — la date d'abord, la création ensuite —
 * pour que « suivant » mène là où l'œil l'attend. Les contenus sans date
 * (les idées) ferment la marche plutôt que d'ouvrir : on les a mis de côté
 * justement parce qu'ils ne sont pas dans le flux.
 */
export async function fetchNeighbours(
  supabase: Supabase,
  brandId: string,
  currentId: string,
): Promise<Neighbours> {
  // Une seule requête, sur les identifiants uniquement : la liste complète
  // d'une marque reste légère, et c'est la seule façon d'avoir un rang exact
  // sans compter à part.
  const { data } = await supabase
    .from("contents")
    .select("id")
    .eq("brand_id", brandId)
    .order("date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  const at = ids.indexOf(currentId);

  if (at === -1) {
    return { prevId: null, nextId: null, position: 0, total: ids.length };
  }
  return {
    prevId: at > 0 ? ids[at - 1] : null,
    nextId: at < ids.length - 1 ? ids[at + 1] : null,
    position: at + 1,
    total: ids.length,
  };
}
