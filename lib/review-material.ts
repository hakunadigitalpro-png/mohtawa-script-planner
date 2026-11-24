import type { createClient } from "@/lib/supabase/server";
import { isLongformType } from "@/lib/constants";
import { partNumber } from "@/lib/article";
import { sectionsToText } from "@/lib/longform";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ReviewVisual = {
  id: string;
  url: string;
  /**
   * Faux pour une diapo de story : les remarques par visuel s'ancrent sur
   * `content_media` (0057), pas sur `story_slides`. Le client regarde, et
   * laisse son mot « sur l'ensemble ».
   */
  commentable: boolean;
};

export type ReviewMaterial = {
  visuals: ReviewVisual[];
  /** Le texte à relire : script d'un reel, voix off d'un vlog, diapos d'une story. */
  script: string | null;
  /** Article : ses parties, à afficher comme un article et non en un pavé. */
  article?: {
    parts: { number: number | null; title: string | null; body: string | null }[];
    /** À vérifier par l'auteur avant de valider. */
    claims: string[];
  };
};

/**
 * Ce que l'écran de validation montre d'un contenu — et donc, exactement, ce
 * qui décide si on peut l'envoyer au client (`whyNotSendable`). Une seule
 * lecture pour les deux : si l'écran change, le garde suit.
 *
 * Requêtes groupées pour toute la file, pas une par contenu.
 */
export async function fetchReviewMaterial(
  supabase: Supabase,
  items: { id: string; type: string | null }[],
): Promise<Map<string, ReviewMaterial>> {
  const result = new Map<string, ReviewMaterial>();
  if (items.length === 0) return result;

  const ids = items.map((i) => i.id);
  const idsOf = (t: string) => items.filter((i) => i.type === t).map((i) => i.id);
  const reelIds = idsOf("reel");
  const vlogIds = idsOf("vlog");
  const storyIds = idsOf("story");
  const longIds = items.filter((i) => isLongformType(i.type)).map((i) => i.id);

  const articleIds = idsOf("article");

  const [mediaRes, reelRes, vlogRes, slidesRes, sectionsRes, claimsRes] = await Promise.all([
    supabase
      .from("content_media")
      .select("id, content_id, position, image_url")
      .in("content_id", ids)
      .order("position", { ascending: true }),
    reelIds.length
      ? supabase
          .from("reel_details")
          .select("content_id, script_full")
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
          .select("id, content_id, slot_number, body, image_url")
          .in("content_id", storyIds)
          .order("slot_number", { ascending: true })
      : Promise.resolve({ data: [] }),
    // Les parties et l'invité : la transcription n'est pas pour le client.
    longIds.length
      ? supabase
          .from("content_sections")
          .select("content_id, kind, title, body, position, role")
          .in("content_id", longIds)
          .in("kind", ["section", "guest"])
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
    articleIds.length
      ? supabase
          .from("article_claims")
          .select("content_id, text, checked_at")
          .in("content_id", articleIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  for (const item of items) result.set(item.id, { visuals: [], script: null });

  for (const m of (mediaRes.data ?? []) as {
    id: string;
    content_id: string;
    image_url: string | null;
  }[]) {
    if (!m.image_url) continue;
    result.get(m.content_id)?.visuals.push({
      id: m.id,
      url: m.image_url,
      commentable: true,
    });
  }

  for (const r of (reelRes.data ?? []) as {
    content_id: string;
    script_full: string | null;
  }[]) {
    const entry = result.get(r.content_id);
    if (entry && r.script_full?.trim()) entry.script = r.script_full;
  }

  for (const v of (vlogRes.data ?? []) as {
    content_id: string;
    voiceover: string | null;
  }[]) {
    const entry = result.get(v.content_id);
    if (entry && v.voiceover?.trim()) entry.script = v.voiceover;
  }

  const parts = new Map<
    string,
    { title: string | null; body: string | null; role?: string | null }[]
  >();
  const guests = new Map<string, string>();
  for (const s of (sectionsRes.data ?? []) as {
    content_id: string;
    kind: string;
    title: string | null;
    body: string | null;
    role?: string | null;
  }[]) {
    if (s.kind === "guest") {
      const line = [s.title?.trim(), s.body?.trim()].filter(Boolean).join(" — ");
      if (line) guests.set(s.content_id, `Invité : ${line}`);
      continue;
    }
    const list = parts.get(s.content_id) ?? [];
    list.push(s);
    parts.set(s.content_id, list);
  }
  for (const [contentId, list] of parts) {
    const entry = result.get(contentId);
    // Des titres sans une ligne de texte ne sont pas de la matière à valider.
    if (entry && list.some((s) => s.body?.trim())) {
      entry.script = [guests.get(contentId), sectionsToText(list)]
        .filter(Boolean)
        .join("\n\n");
    }
  }

  // Un article se relit comme un article. Ce que l'équipe a déjà vérifié n'est
  // plus à demander au client.
  for (const item of items) {
    const list = item.type === "article" ? parts.get(item.id) : undefined;
    const entry = result.get(item.id);
    if (!list || !entry || !list.some((s) => s.body?.trim())) continue;
    entry.article = {
      parts: list.map((p, i) => ({
        number: partNumber("article", list, i),
        title: p.title,
        body: p.body,
      })),
      claims: ((claimsRes.data ?? []) as {
        content_id: string;
        text: string;
        checked_at: string | null;
      }[])
        .filter((c) => c.content_id === item.id && !c.checked_at)
        .map((c) => c.text),
    };
  }

  // Une story : ses images deviennent les visuels, ses textes le script —
  // « Diapo 1 : … ». Sans ça, un client ne pouvait pas en valider une.
  const storyTexts = new Map<string, string[]>();
  for (const s of (slidesRes.data ?? []) as {
    id: string;
    content_id: string;
    slot_number: number;
    body: string | null;
    image_url: string | null;
  }[]) {
    const entry = result.get(s.content_id);
    if (!entry) continue;
    if (s.image_url) {
      entry.visuals.push({ id: s.id, url: s.image_url, commentable: false });
    }
    if (s.body?.trim()) {
      const list = storyTexts.get(s.content_id) ?? [];
      list.push(`Diapo ${s.slot_number} : ${s.body.trim()}`);
      storyTexts.set(s.content_id, list);
    }
  }
  for (const [contentId, texts] of storyTexts) {
    const entry = result.get(contentId);
    if (entry) entry.script = texts.join("\n\n");
  }

  return result;
}
