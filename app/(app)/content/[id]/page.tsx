import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, FileDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getTranslations } from "next-intl/server";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { formatDateLongFr, formatTimeFr } from "@/lib/utils";
import {
  fetchNeighbours,
  scopeFromParams,
  scopeToQuery,
} from "@/lib/content-neighbours";
import { ContentPager } from "@/components/content-detail/content-pager";
import { NextStepButton } from "@/components/content-detail/next-step-button";
import { ContentTitleField } from "@/components/content-detail/content-title-field";
import { buttonVariants } from "@/components/ui/button";
import {
  nextStep,
  primaryPublication,
  todayISO,
} from "@/lib/content-lifecycle";
import { sendBlockerFor } from "@/lib/content-lifecycle-db";

// Les appels IA de cette page peuvent durer jusqu'à AI_BUDGET_MS (90 s). Sans
// effet sur notre serveur (réglage Vercel), gardé pour qu'un hébergeur à durée
// limitée ne coupe pas avant nous.
export const maxDuration = 120;
import { Badge, ColorDot } from "@/components/ui/badge";
import {
  typeColor,
  typeLabel,
  statusColor,
  statusLabel,
  statusKey,
  isLongformType,
} from "@/lib/constants";
import { DetailTabs } from "@/components/content-detail/detail-tabs";
import { fetchTeam } from "@/lib/brand-team";
import { DeleteContentButton } from "@/components/content-detail/delete-button";
import { ShareButton } from "@/components/content-detail/share-button";
import {
  CommentsProvider,
  CommentsDrawer,
  CommentsInboxButton,
} from "@/components/comments";
import type { Comment } from "@/components/comments";
import { cleanBrief } from "@/lib/article";
import { countToConfirm } from "@/lib/article-checks";
import type {
  ArticleClaim,
  Content,
  ContentMedia,
  ContentSection,
  DerivedContent,
  ReelDetails,
  StoryDetails,
  VlogDetails,
  StorySlide,
  StoryboardScene,
  Performance,
  ChecklistItem,
  ContentPublication,
  ScenePreset,
} from "@/lib/types";

export default async function ContentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // D'où l'on vient : le mois, le filtre plateforme, ou l'onglet Idées. Le
  // compte « 4 / 17 » et les flèches s'y tiennent, au lieu de parcourir
  // toute la marque.
  const sp = await searchParams;
  const scope = scopeFromParams(sp);
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect("/login");

  const [{ role, active: activeBrand }, { data: content }] = await Promise.all([
    resolveActiveBrand(),
    supabase.from("contents").select("*").eq("id", id).maybeSingle(),
  ]);

  if (!content) notFound();

  // La marque, c'est celle du contenu qu'on regarde. Un lien — e-mail,
  // notification, tâche — peut ouvrir un contenu d'une autre marque : on
  // bascule dessus AVANT de décider quoi que ce soit, parce que le rôle est
  // par marque, pas par cookie. La RLS a déjà répondu : si la ligne est là,
  // la personne est membre de cette marque.
  if (activeBrand && content.brand_id !== activeBrand.id) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === "string") search.set(key, value);
      else if (Array.isArray(value)) value.forEach((v) => search.append(key, v));
    }
    const qs = search.toString();
    const here = `/content/${id}${qs ? `?${qs}` : ""}`;
    redirect(
      `/switch-brand?to=${content.brand_id}&next=${encodeURIComponent(here)}`,
    );
  }

  // Un "viewer" (client invité) n'a rien à faire dans l'éditeur : il y
  // trouvait l'autosave, les boutons IA, le partage et la suppression.
  // On l'envoie sur sa vue de validation, positionnée sur le contenu qu'il
  // vient d'ouvrir — avec le rôle de la BONNE marque, d'où l'ordre.
  if (role === "viewer") redirect(`/review?c=${id}`);

  const [
    reelRes,
    storyRes,
    vlogRes,
    slidesRes,
    scenesRes,
    perfRes,
    pillarsRes,
    objectivesRes,
    commentsRes,
    readRes,
    checklistItemsRes,
    publicationsRes,
    scenePresetsRes,
    mediaRes,
    brandKitRes,
    sectionsRes,
    derivedRes,
    sourceRes,
    articleRes,
    claimsRes,
  ] = await Promise.all([
    supabase.from("reel_details").select("*").eq("content_id", id).maybeSingle(),
    supabase.from("story_details").select("*").eq("content_id", id).maybeSingle(),
    supabase.from("vlog_details").select("*").eq("content_id", id).maybeSingle(),
    supabase
      .from("story_slides")
      .select("*")
      .eq("content_id", id)
      .order("slot_number", { ascending: true }),
    supabase
      .from("storyboard_scenes")
      .select("*")
      .eq("content_id", id)
      .order("scene_number", { ascending: true }),
    supabase.from("performances").select("*").eq("content_id", id).maybeSingle(),
    supabase
      .from("brand_pillars")
      .select("id, name, objective")
      .eq("brand_id", content.brand_id)
      .order("position", { ascending: true }),
    supabase
      .from("brand_objectives")
      .select("id, name")
      .eq("brand_id", content.brand_id)
      .order("position", { ascending: true }),
    supabase.rpc("list_content_comments_with_authors", { p_content_id: id }),
    supabase
      .from("content_reads")
      .select("last_comment_read_at")
      .eq("content_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("content_checklist_items")
      .select("*")
      .eq("content_id", id)
      .order("category", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("content_publications")
      .select("*")
      .eq("content_id", id)
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    // Setups de scène réutilisables de la marque (Storyboard Lot 2)
    supabase
      .from("brand_scene_presets")
      .select("*")
      .eq("brand_id", content.brand_id)
      .order("position", { ascending: true }),
    supabase
      .from("content_media")
      .select("*")
      .eq("content_id", id)
      .order("position", { ascending: true }),
    // Audience du Brand Kit (migration 0031) : pré-remplit le champ
    // "audience" du générateur IA — évite de la retaper à chaque vidéo.
    supabase
      .from("brand_kits")
      .select("audience")
      .eq("brand_id", content.brand_id)
      .maybeSingle(),
    // Formats longs : les parties, et les contenus qu'on en a tirés.
    isLongformType(content.type)
      ? supabase
          .from("content_sections")
          .select("*")
          .eq("content_id", id)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
    isLongformType(content.type)
      ? supabase
          .from("contents")
          .select("id, type, title, status, date")
          .eq("source_content_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // Un extrait dit d'où il vient.
    content.source_content_id
      ? supabase
          .from("contents")
          .select("id, title")
          .eq("id", content.source_content_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    content.type === "article"
      ? supabase
          .from("article_briefs")
          .select("brief, cover_brief, versions")
          .eq("content_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    content.type === "article"
      ? supabase
          .from("article_claims")
          .select("id, content_id, position, text, checked_at")
          .eq("content_id", id)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const reel = (reelRes.data ?? null) as ReelDetails | null;
  const story = (storyRes.data ?? null) as StoryDetails | null;
  const vlog = (vlogRes.data ?? null) as VlogDetails | null;
  const slides = (slidesRes.data ?? []) as StorySlide[];
  const scenes = (scenesRes.data ?? []) as StoryboardScene[];
  const perf = (perfRes.data ?? null) as Performance | null;
  const visuals = (mediaRes.data ?? []) as ContentMedia[];
  const pillars = (pillarsRes.data ?? []) as {
    id: string;
    name: string;
    objective: string | null;
  }[];
  const objectives = (objectivesRes.data ?? []) as { id: string; name: string }[];
  const sections = (sectionsRes.data ?? []) as ContentSection[];
  const derived = (derivedRes.data ?? []) as DerivedContent[];
  const source = sourceRes.data as { id: string; title: string | null } | null;
  const articleRow = articleRes.data as {
    brief: unknown;
    cover_brief: string | null;
    versions: { at: string; title: string | null }[] | null;
  } | null;
  const article =
    content.type === "article"
      ? {
          brief: articleRow?.brief ? cleanBrief(articleRow.brief) : null,
          coverBrief: articleRow?.cover_brief ?? "",
          claims: (claimsRes.data ?? []) as ArticleClaim[],
          versions: (articleRow?.versions ?? []).map((v) => ({
            at: v.at,
            title: v.title ?? "",
          })),
        }
      : undefined;
  const toConfirm = article
    ? countToConfirm(
        [
          content.title,
          content.subtitle,
          content.caption,
          ...sections
            .filter((s) => s.kind === "section")
            .flatMap((s) => [s.title, s.body]),
        ]
          .filter(Boolean)
          .join("\n"),
      )
    : 0;
  const comments = (commentsRes.data ?? []) as Comment[];
  const lastReadAt = readRes.data?.last_comment_read_at ?? "1970-01-01T00:00:00Z";
  const checklistItems = (checklistItemsRes.data ?? []) as ChecklistItem[];
  const publications = (publicationsRes.data ?? []) as ContentPublication[];
  const scenePresets = (scenePresetsRes.data ?? []) as ScenePreset[];
  const brandAudience = (brandKitRes.data as { audience: string | null } | null)
    ?.audience ?? null;

  const c = content as Content;

  // Avant le clic : pourquoi « Envoyer au client » ne serait pas possible.
  // Même règle que l'action serveur et que le menu Statut (`whyNotSendable`),
  // lue seulement quand c'est l'étape en cours.
  const today = todayISO();
  const primary = primaryPublication(publications);
  const step = nextStep({
    status: c.status,
    type: c.type,
    publicationDate: primary?.scheduled_date ?? null,
    today,
    url: primary?.url ?? null,
  });
  const sendBlocker =
    step.kind === "send_to_client"
      ? await sendBlockerFor(supabase, {
          id: c.id,
          type: c.type,
          caption: c.caption,
          brand_id: c.brand_id,
          preview_url: c.preview_url,
        })
      : null;

  const tContent = await getTranslations("content");
  const tStoryboard = await getTranslations("storyboard");
  const tStories = await getTranslations("stories");
  const tTabs = await getTranslations("tabs");
  const tType = await getTranslations("contentTypes");
  const tStatus = await getTranslations("statuses");
  const tComments = await getTranslations("comments");

  const safeT = (fn: (k: string) => string, key: string, fallback: string) => {
    try {
      return fn(key);
    } catch {
      return fallback;
    }
  };

  // Construction du dictionnaire target labels pour la sidebar des commentaires.
  // (Le mapping UUID → numéro de scène est calculable ici, depuis les scenes.)
  const targetLabels: Record<string, string> = {};
  scenes.forEach((s) => {
    const planLabel = tStoryboard("planNumber", {
      n: String(s.scene_number).padStart(2, "0"),
    });
    targetLabels[`scene:${s.id}`] = `${tTabs("storyboard")} · ${planLabel}`;
  });
  for (let i = 1; i <= 5; i++) {
    const slotLabel =
      i === 1
        ? tStories("slotLabels.title")
        : i === 5
          ? tStories("slotLabels.cta")
          : tStories("slotLabels.default", { n: i });
    targetLabels[`slide:${i}`] = `${tTabs("stories")} · ${slotLabel}`;
  }
  // Les visuels des formats non-vidéo. Un carrousel numérote ses diapos —
  // c'est le mot que le client lit sur son écran de validation, et c'est
  // donc celui qu'il faut retrouver ici. Un post ou une infographie n'en a
  // qu'un : « Diapo 1 » n'y voudrait rien dire.
  visuals.forEach((v, i) => {
    targetLabels[`media:${v.id}`] =
      visuals.length > 1
        ? tComments("labels.carouselSlide", { n: i + 1 })
        : tComments("labels.visual");
  });

  // Depuis que la date a quitté l'onglet Plan pour vivre dans les
  // publications (« Idée 10 »), un contenu sans plateforme programmée
  // n'affichait sa date NULLE PART — alors que le calendrier, lui, la
  // connaît via `contents.date`. On la remonte dans l'en-tête : c'est elle
  // qui dit « où je suis » quand on arrive depuis le planning.
  // Les voisins au planning : enchaaîner sans repasser par le calendrier.
  const nav = await fetchNeighbours(supabase, content.brand_id, c.id, scope);

  const datedPubs = publications
    .filter((p) => p.scheduled_date)
    .sort((a, b) =>
      `${a.scheduled_date}${a.scheduled_time ?? "99"}`.localeCompare(
        `${b.scheduled_date}${b.scheduled_time ?? "99"}`,
      ),
    );
  const whenDate = datedPubs[0]?.scheduled_date ?? c.date ?? null;
  const whenTime = formatTimeFr(datedPubs[0]?.scheduled_time);
  // Plusieurs plateformes à des dates différentes : l'en-tête annonce la
  // première et signale qu'il y en a d'autres, le détail reste en dessous.
  const otherDates = new Set(datedPubs.map((p) => p.scheduled_date)).size - 1;

  return (
    <CommentsProvider
      contentId={c.id}
      currentUserId={user.id}
      initialComments={comments}
      initialLastReadAt={lastReadAt}
    >
      <div className="space-y-6">
        <PageHeader
          backHref={`/calendar${scopeToQuery(scope)}`}
          backLabel={tContent("backToCalendar")}
          aside={<ContentPager nav={nav} />}
          title={
            <ContentTitleField
              contentId={c.id}
              initialTitle={c.title ?? ""}
              placeholder={tContent("untitled")}
            />
          }
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {source && (
                <Link
                  href={`/content/${source.id}?tab=extracts`}
                  className="max-w-full basis-full truncate text-sm text-white/70 hover:text-white"
                >
                  Extrait de : <bdi>{source.title || "Sans titre"}</bdi>
                </Link>
              )}
              {/* Une idée n'a pas encore de format : on le dit, plutôt que
                  d'afficher un tiret qui ressemble à une donnée manquante. */}
              <ColorDot color={typeColor(c.type)} />
              <span className="font-medium text-white/70">
                {c.type
                  ? safeT(tType, c.type, typeLabel(c.type))
                  : "Format à choisir"}
              </span>
              <Badge
                className="ms-1 text-white"
                style={{ background: statusColor(c.status) }}
              >
                {safeT(
                  tStatus,
                  statusKey(c.status, c.type),
                  statusLabel(c.status, c.type),
                )}
              </Badge>
              <span className="ms-1 inline-flex items-center gap-1.5 font-medium text-white/70">
                <CalendarDays className="size-3.5 shrink-0" />
                {whenDate ? (
                  <>
                    <span className="first-letter:uppercase">
                      {formatDateLongFr(whenDate)}
                    </span>
                    {whenTime && <span>· {whenTime}</span>}
                    {otherDates > 0 && (
                      <span>
                        · +{otherDates} autre{otherDates > 1 ? "s" : ""} date
                        {otherDates > 1 ? "s" : ""}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-white/60">Pas encore placé</span>
                )}
              </span>
            </div>
          }
          actions={
            <>
              {/* Le bouton qui suit le contenu : la seule action en orange de
                  la rangée. Il porte lui-même `data-tour="content-review"`. */}
              <NextStepButton
                contentId={c.id}
                status={c.status}
                type={c.type}
                publications={publications}
                today={today}
                brandId={c.brand_id}
                canInvite={role === "owner" || role === "admin"}
                sendBlocker={sendBlocker}
                toConfirm={toConfirm}
              />
              <span data-tour="content-comments" className="inline-flex">
                <CommentsInboxButton />
              </span>
              <ShareButton
                contentId={c.id}
                initialToken={c.share_token}
                initialMode={c.share_mode}
              />
              <Link
                href={`/print/${c.id}`}
                target="_blank"
                rel="noopener"
                // Même gabarit que ses voisins : la rangée avait deux hauteurs.
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <FileDown className="size-3.5" />
                {tContent("exportPdf")}
              </Link>
              <DeleteContentButton contentId={c.id} derivedCount={derived.length} />
            </>
          }
        />

        <DetailTabs
          defaultTab={typeof sp.tab === "string" ? sp.tab : undefined}
          content={c}
          reel={reel}
          story={story}
          vlog={vlog}
          slides={slides}
          scenes={scenes}
          perf={perf}
          visuals={visuals}
          brandPillars={pillars}
          team={await fetchTeam(supabase, content.brand_id)}
          brandObjectives={objectives}
          checklistItems={checklistItems}
          publications={publications}
          scenePresets={scenePresets}
          brandId={content.brand_id}
          brandAudience={brandAudience}
          sections={sections}
          derived={derived}
          article={article}
          aiEnabled={activeBrand?.ai_enabled !== false}
        />
      </div>

      <CommentsDrawer targetLabels={targetLabels} />
    </CommentsProvider>
  );
}
