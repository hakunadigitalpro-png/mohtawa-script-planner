import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { PageHeader } from "@/components/page-header";
import { ReviewDeck, type ReviewItem, type ReviewNote } from "./review-deck";
import type { ContentMedia } from "@/lib/types";

type CommentRow = {
  id: string;
  content_id: string;
  target_type: string;
  target_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
};

type ContentRow = {
  id: string;
  title: string | null;
  type: string;
  date: string | null;
  platform: string | null;
  status: string;
  caption: string | null;
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const [{ active }, me] = await Promise.all([
    resolveActiveBrand(),
    getCachedUser(),
  ]);
  if (!active) redirect("/dashboard");

  const params = await searchParams;
  const supabase = await createClient();

  // Même recalcul paresseux que sur le Calendrier et le Dashboard : l'app
  // n'a aucune tâche planifiée, les statuts se mettent à jour à la lecture.
  // Sans cet appel, un client qui vit sur cette page ne verrait jamais un
  // contenu passer en "Publié".
  await supabase.rpc("recompute_live_statuses", { p_brand_id: active.id });

  // La file d'attente : ce qui lui a été explicitement soumis. On y ajoute
  // le contenu ouvert depuis le calendrier (?c=) même s'il n'attend rien —
  // le client a le droit de regarder sans qu'on lui demande son avis.
  const { data: queueData } = await supabase
    .from("contents")
    .select("id, title, type, date, platform, status, caption")
    .eq("brand_id", active.id)
    .eq("status", "pending_review")
    .order("date", { ascending: true, nullsFirst: false });

  const queue = (queueData ?? []) as ContentRow[];
  const ids = queue.map((c) => c.id);

  let extra: ContentRow | null = null;
  if (params.c && !ids.includes(params.c)) {
    const { data } = await supabase
      .from("contents")
      .select("id, title, type, date, platform, status, caption")
      .eq("brand_id", active.id)
      .eq("id", params.c)
      .maybeSingle();
    extra = (data as ContentRow | null) ?? null;
    if (extra) ids.push(extra.id);
  }

  // Les visuels et les scripts en DEUX requêtes groupées pour toute la file,
  // pas une par contenu : un client avec 10 carrousels en attente chargerait
  // sinon 20 allers-retours.
  const [mediaRes, reelRes, vlogRes, commentRes] = ids.length
    ? await Promise.all([
        supabase
          .from("content_media")
          .select("id, content_id, position, image_url, created_at")
          .in("content_id", ids)
          .order("position", { ascending: true }),
        supabase
          .from("reel_details")
          .select("content_id, script_full")
          .in("content_id", ids),
        supabase
          .from("vlog_details")
          .select("content_id, voiceover")
          .in("content_id", ids),
        // Le fil de la validation : ce que le client a écrit, et ce que
        // l'équipe lui a répondu. Sans ça il recevait une notification
        // « on t'a répondu » qui ne menait à rien de lisible.
        //
        // Volontairement limité à `media` et `plan` : les policies laissent
        // un membre lire TOUS les fils du contenu, y compris les discussions
        // internes de l'équipe sur le script. Elles ne le regardent pas.
        supabase
          .from("content_comments")
          .select("id, content_id, target_type, target_id, user_id, body, created_at")
          .in("content_id", ids)
          .in("target_type", ["media", "plan"])
          .order("created_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const mediaByContent = new Map<string, ContentMedia[]>();
  for (const m of (mediaRes.data ?? []) as ContentMedia[]) {
    const list = mediaByContent.get(m.content_id) ?? [];
    list.push(m);
    mediaByContent.set(m.content_id, list);
  }

  const scriptByContent = new Map<string, string>();
  for (const r of (reelRes.data ?? []) as {
    content_id: string;
    script_full: string | null;
  }[]) {
    if (r.script_full) scriptByContent.set(r.content_id, r.script_full);
  }
  for (const v of (vlogRes.data ?? []) as {
    content_id: string;
    voiceover: string | null;
  }[]) {
    if (v.voiceover) scriptByContent.set(v.content_id, v.voiceover);
  }

  const notesByContent = new Map<string, ReviewNote[]>();
  for (const r of (commentRes.data ?? []) as CommentRow[]) {
    // `plan` sert aussi aux champs du formulaire côté équipe ; seul
    // `general` appartient à la boucle de validation.
    if (r.target_type === "plan" && r.target_id !== "general") continue;
    const list = notesByContent.get(r.content_id) ?? [];
    list.push({
      id: r.id,
      mediaId: r.target_type === "media" ? r.target_id : null,
      body: r.body,
      mine: Boolean(me && r.user_id === me.id),
      createdAt: r.created_at,
    });
    notesByContent.set(r.content_id, list);
  }

  const toItem = (c: ContentRow): ReviewItem => ({
    id: c.id,
    title: c.title,
    type: c.type,
    date: c.date,
    platform: c.platform,
    status: c.status,
    caption: c.caption,
    visuals: (mediaByContent.get(c.id) ?? [])
      .filter((m) => m.image_url)
      .map((m) => ({ id: m.id, url: m.image_url as string })),
    script: scriptByContent.get(c.id) ?? null,
    notes: notesByContent.get(c.id) ?? [],
  });

  const items = queue.map(toItem);
  if (extra) items.unshift(toItem(extra));

  // On démarre sur le contenu demandé depuis le calendrier, sinon au début.
  const startIndex = params.c
    ? Math.max(0, items.findIndex((i) => i.id === params.c))
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/calendar"
        backLabel="Retour au calendrier"
        eyebrow={active.name}
        title="À valider"
        subtitle={
          items.length === 0
            ? "Rien ne t'attend pour le moment."
            : "Regarde, puis dis-nous si c'est bon ou ce qu'il faut changer."
        }
      />
      <ReviewDeck items={items} startIndex={startIndex} />
    </div>
  );
}
