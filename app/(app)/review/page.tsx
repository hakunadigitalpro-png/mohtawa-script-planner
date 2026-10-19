import { redirect } from "next/navigation";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { PageHeader } from "@/components/page-header";
import { ReviewDeck, type ReviewItem, type ReviewNote } from "./review-deck";
import { fetchReviewMaterial, type ReviewMaterial } from "@/lib/review-material";
import { formatDateFr } from "@/lib/utils";

type AdCampaignQueue = {
  id: string;
  title: string;
  theme: string | null;
  date_start: string | null;
  date_end: string | null;
};

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
  preview_url: string | null;
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
  const [{ data: queueData }, { data: adsData }] = await Promise.all([
    supabase
      .from("contents")
      .select("id, title, type, date, platform, status, caption, preview_url")
      .eq("brand_id", active.id)
      .eq("status", "pending_review")
      .order("date", { ascending: true, nullsFirst: false }),
    // Les campagnes Ads soumises partagent la file de validation : la fiche
    // vit sur `/ads/[id]`, mais c'est ici qu'on arrive en premier quand le
    // menu dit « À valider ».
    supabase
      .from("ad_campaigns")
      .select("id, title, theme, date_start, date_end")
      .eq("brand_id", active.id)
      .eq("review_state", "pending_review")
      .order("date_start", { ascending: true, nullsFirst: false }),
  ]);

  const adQueue = (adsData ?? []) as AdCampaignQueue[];

  const queue = (queueData ?? []) as ContentRow[];
  const ids = queue.map((c) => c.id);

  let extra: ContentRow | null = null;
  if (params.c && !ids.includes(params.c)) {
    // Résolu par son id, sans filtrer sur la marque active : un client
    // invité sur deux marques peut arriver ici depuis l'e-mail de l'autre.
    // Si c'est le cas, on bascule d'abord — le rôle est par marque.
    const { data } = await supabase
      .from("contents")
      .select("id, brand_id, title, type, date, platform, status, caption, preview_url")
      .eq("id", params.c)
      .maybeSingle();
    const found = (data as (ContentRow & { brand_id: string }) | null) ?? null;
    if (found && found.brand_id !== active.id) {
      redirect(
        `/switch-brand?to=${found.brand_id}&next=${encodeURIComponent(`/review?c=${found.id}`)}`,
      );
    }
    extra = found;
    if (extra) ids.push(extra.id);
  }

  // Ce que l'écran montre — visuels, script, diapos d'une story — vient du
  // même chargeur que le garde « Envoyer au client » (`fetchReviewMaterial`,
  // `whyNotSendable`) : si l'un change, l'autre suit. Requêtes groupées pour
  // toute la file, pas une par contenu.
  const all = extra ? [...queue, extra] : queue;
  const [material, commentRes] = ids.length
    ? await Promise.all([
        fetchReviewMaterial(
          supabase,
          all.map((c) => ({ id: c.id, type: c.type })),
        ),
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
    : [new Map<string, ReviewMaterial>(), { data: [] }];

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
    previewUrl: c.preview_url,
    visuals: material.get(c.id)?.visuals ?? [],
    script: material.get(c.id)?.script ?? null,
    notes: notesByContent.get(c.id) ?? [],
  });

  const items = queue.map(toItem);
  if (extra) items.unshift(toItem(extra));

  // On démarre sur le contenu demandé depuis le calendrier, sinon au début.
  const startIndex = params.c
    ? Math.max(0, items.findIndex((i) => i.id === params.c))
    : 0;

  const nothingWaiting = items.length === 0 && adQueue.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/calendar"
        backLabel="Retour au calendrier"
        eyebrow={active.name}
        title="À valider"
        subtitle={
          nothingWaiting
            ? "Rien ne t'attend pour le moment."
            : "Regarde, puis dis-nous si c'est bon ou ce qu'il faut changer."
        }
      />
      {adQueue.length > 0 ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="h-4 w-4 text-foreground/60" />
            Campagnes publicitaires
          </h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {adQueue.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/ads/${c.id}`}
                  className="block rounded-2xl border border-foreground/10 bg-card p-3 transition hover:border-accent/40"
                >
                  <div className="text-sm font-medium text-foreground">
                    {c.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {[
                      c.theme,
                      c.date_start ? formatDateFr(c.date_start) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Proposition à relire"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {items.length > 0 ? (
        <ReviewDeck items={items} startIndex={startIndex} />
      ) : null}
    </div>
  );
}
