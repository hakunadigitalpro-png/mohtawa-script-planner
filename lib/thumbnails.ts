import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * La première image d'un contenu, quel que soit son format.
 *
 * Les visuels ne vivent pas au même endroit selon le type : un carrousel
 * range les siens dans `content_media` (0038), une story dans `story_slides`
 * (0004), un reel ou un vlog dans les plans de son `storyboard_scenes`.
 * Trois tables, donc trois requêtes — mais groupées pour tout le mois, pas
 * une par contenu.
 *
 * Priorité à `content_media` : c'est le visuel final publié. Une image de
 * storyboard n'est qu'un repère de tournage, elle ne vaut que faute de mieux.
 */
export async function fetchThumbnails(
  supabase: Supabase,
  contentIds: string[],
): Promise<Map<string, string>> {
  const thumbs = new Map<string, string>();
  if (!contentIds.length) return thumbs;

  const [mediaRes, slidesRes, scenesRes] = await Promise.all([
    supabase
      .from("content_media")
      .select("content_id, image_url, position")
      .in("content_id", contentIds)
      .not("image_url", "is", null)
      .order("position", { ascending: true }),
    supabase
      .from("story_slides")
      .select("content_id, image_url, slot_number")
      .in("content_id", contentIds)
      .not("image_url", "is", null)
      .order("slot_number", { ascending: true }),
    supabase
      .from("storyboard_scenes")
      .select("content_id, image_url, scene_number")
      .in("content_id", contentIds)
      .not("image_url", "is", null)
      .order("scene_number", { ascending: true }),
  ]);

  // Chaque requête est triée par position croissante : on garde la PREMIÈRE
  // ligne de chaque contenu et on ignore les suivantes. Les sources sont
  // parcourues de la moins fiable à la plus fiable, et une source déjà
  // renseignée par une meilleure n'est plus écrasée.
  const seenFrom = new Set<string>();
  for (const res of [scenesRes, slidesRes, mediaRes]) {
    seenFrom.clear();
    for (const row of (res.data ?? []) as {
      content_id: string;
      image_url: string | null;
    }[]) {
      if (!row.image_url) continue;
      if (seenFrom.has(row.content_id)) continue; // pas la première de CE contenu
      seenFrom.add(row.content_id);
      thumbs.set(row.content_id, row.image_url);
    }
  }

  return thumbs;
}
