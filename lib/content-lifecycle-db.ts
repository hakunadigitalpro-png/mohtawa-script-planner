import type { createClient } from "@/lib/supabase/server";
import { isSimpleType } from "@/lib/constants";
import { hasMaterial, statusAfterFilming } from "@/lib/content-lifecycle";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Le moteur (`lib/content-lifecycle.ts`) est pur. Ici vivent les quelques
 * lectures et écritures dont les actions serveur ont besoin pour l'appliquer
 * — côté serveur seulement, jamais depuis un composant.
 */

/** Une publication datée existe-t-elle ? C'est ce que « Programmé » exige. */
export async function hasDatedPublication(
  supabase: Supabase,
  contentId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("content_publications")
    .select("id", { count: "exact", head: true })
    .eq("content_id", contentId)
    .not("scheduled_date", "is", null);
  return (count ?? 0) > 0;
}

/**
 * Après qu'une scène ou une diapo a été marquée filmée : la vidéo avance en
 * Tournage ou en Montage si le moteur le dit. Remplace la RPC
 * `recompute_content_status` (0015), dont c'était la seule règle vivante.
 */
export async function applyFilmingProgress(
  supabase: Supabase,
  contentId: string,
): Promise<void> {
  const { data: content } = await supabase
    .from("contents")
    .select("status, type")
    .eq("id", contentId)
    .maybeSingle();
  if (!content) return;
  const row = content as { status: string; type: string | null };
  if (!row.type || isSimpleType(row.type)) return;

  const [scenesRes, slidesRes] = await Promise.all([
    supabase
      .from("storyboard_scenes")
      .select("filmed")
      .eq("content_id", contentId),
    supabase.from("story_slides").select("filmed").eq("content_id", contentId),
  ]);
  const scenes = (scenesRes.data ?? []) as { filmed: boolean | null }[];
  const slides = (slidesRes.data ?? []) as { filmed: boolean | null }[];
  // Un reel se tourne par scènes, une story par diapos : on lit la table qui
  // a des lignes, l'autre est vide.
  const rows = scenes.length > 0 ? scenes : slides;
  const next = statusAfterFilming({
    status: row.status,
    type: row.type,
    filmed: rows.filter((r) => r.filmed === true).length,
    total: rows.length,
  });
  if (!next) return;

  await supabase.from("contents").update({ status: next }).eq("id", contentId);
}

/**
 * La matière de plusieurs contenus en une passe — pour dire « Prêt » sans
 * mentir sur le tableau de bord. Une requête par table, pas une par contenu
 * (même motif que `lib/thumbnails.ts`).
 */
export async function fetchMaterial(
  supabase: Supabase,
  items: { id: string; type: string | null }[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (items.length === 0) return result;

  const idsOf = (pred: (t: string | null) => boolean) =>
    items.filter((i) => pred(i.type)).map((i) => i.id);
  const reelIds = idsOf((t) => t === "reel");
  const vlogIds = idsOf((t) => t === "vlog");
  const storyIds = idsOf((t) => t === "story");
  const simpleIds = idsOf((t) => isSimpleType(t));

  const [reelRes, vlogRes, slidesRes, mediaRes] = await Promise.all([
    reelIds.length
      ? supabase
          .from("reel_details")
          .select("content_id, script_full, intro")
          .in("content_id", reelIds)
      : Promise.resolve({ data: [] }),
    vlogIds.length
      ? supabase
          .from("vlog_details")
          .select("content_id, voiceover")
          .in("content_id", vlogIds)
      : Promise.resolve({ data: [] }),
    storyIds.length
      ? supabase
          .from("story_slides")
          .select("content_id, body")
          .in("content_id", storyIds)
      : Promise.resolve({ data: [] }),
    simpleIds.length
      ? supabase
          .from("content_media")
          .select("content_id")
          .in("content_id", simpleIds)
      : Promise.resolve({ data: [] }),
  ]);

  const script = new Map<string, string | null>();
  for (const r of (reelRes.data ?? []) as {
    content_id: string;
    script_full: string | null;
    intro: string | null;
  }[]) {
    script.set(r.content_id, r.script_full?.trim() ? r.script_full : r.intro);
  }
  const voiceover = new Map<string, string | null>();
  for (const r of (vlogRes.data ?? []) as {
    content_id: string;
    voiceover: string | null;
  }[]) {
    voiceover.set(r.content_id, r.voiceover);
  }
  const slidesWithText = new Map<string, number>();
  for (const r of (slidesRes.data ?? []) as {
    content_id: string;
    body: string | null;
  }[]) {
    if (!r.body?.trim()) continue;
    slidesWithText.set(r.content_id, (slidesWithText.get(r.content_id) ?? 0) + 1);
  }
  const visuals = new Map<string, number>();
  for (const r of (mediaRes.data ?? []) as { content_id: string }[]) {
    visuals.set(r.content_id, (visuals.get(r.content_id) ?? 0) + 1);
  }

  for (const item of items) {
    result.set(
      item.id,
      hasMaterial(item.type, {
        script: script.get(item.id),
        voiceover: voiceover.get(item.id),
        slidesWithText: slidesWithText.get(item.id),
        visuals: visuals.get(item.id),
      }),
    );
  }
  return result;
}
