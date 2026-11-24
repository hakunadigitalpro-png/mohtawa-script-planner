import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { isLongformType, isSimpleType } from "@/lib/constants";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * L'angle écrit au stade « idée » rejoint le champ qui lui correspond, une fois
 * le format connu. Sans ça le texte resterait dans `notes`, que la fiche ne
 * montre plus dès qu'il y a un format : il aurait l'air perdu.
 *
 * Jamais d'écrasement : on n'écrit que dans un champ vide. Renvoie le message
 * d'erreur, ou `null`.
 */
export async function moveNotesIntoFormat(
  supabase: Supabase,
  contentId: string,
  type: string,
  row: { notes: string | null; caption: string | null },
): Promise<string | null> {
  const notes = row.notes?.trim();
  if (!notes) return null;

  if (type === "reel") {
    const { data: existing } = await supabase
      .from("reel_details")
      .select("script_full")
      .eq("content_id", contentId)
      .maybeSingle();
    if (existing?.script_full?.trim()) return null;
    const { error } = await supabase
      .from("reel_details")
      .upsert({ content_id: contentId, script_full: notes });
    return error?.message ?? null;
  }

  if (type === "vlog") {
    const { data: existing } = await supabase
      .from("vlog_details")
      .select("voiceover")
      .eq("content_id", contentId)
      .maybeSingle();
    if (existing?.voiceover?.trim()) return null;
    const { error } = await supabase
      .from("vlog_details")
      .upsert({ content_id: contentId, voiceover: notes });
    return error?.message ?? null;
  }

  if (isLongformType(type)) {
    const { count } = await supabase
      .from("content_sections")
      .select("id", { count: "exact", head: true })
      .eq("content_id", contentId)
      .eq("kind", "section");
    if (count) return null;
    const { error } = await supabase
      .from("content_sections")
      .insert({ content_id: contentId, kind: "section", position: 0, body: notes });
    return error?.message ?? null;
  }

  if (isSimpleType(type) && !row.caption?.trim()) {
    const { error } = await supabase
      .from("contents")
      .update({ caption: notes })
      .eq("id", contentId);
    return error?.message ?? null;
  }
  return null;
}
