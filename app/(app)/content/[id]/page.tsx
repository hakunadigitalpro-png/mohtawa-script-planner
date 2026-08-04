import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// L'autopsie IA (appel Claude) peut prendre 15-30s. Le défaut Vercel est
// de 10s sur le plan Hobby → la fonction était tuée avant de répondre.
// On monte à 60s (max autorisé sur Hobby). Les Server Actions appelées
// depuis cette page héritent de cette durée.
export const maxDuration = 60;
import { Badge, ColorDot } from "@/components/ui/badge";
import {
  typeColor,
  typeLabel,
  statusColor,
  statusLabel,
} from "@/lib/constants";
import { DetailTabs } from "@/components/content-detail/detail-tabs";
import { DeleteContentButton } from "@/components/content-detail/delete-button";
import { ShareButton } from "@/components/content-detail/share-button";
import {
  CommentsProvider,
  CommentsDrawer,
  CommentsInboxButton,
} from "@/components/comments";
import type { Comment } from "@/components/comments";
import type {
  Content,
  ContentMedia,
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!content) notFound();

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
    suggEquipmentRes,
    suggPreparationRes,
    publicationsRes,
    scenePresetsRes,
    mediaRes,
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
    // Suggestions pour les items récurrents (matériel + préparation), basées
    // sur les 3 dernières vidéos de la marque — voir migration 0011.
    supabase.rpc("recent_brand_checklist_labels", {
      p_brand_id: content.brand_id,
      p_category: "equipment",
      p_limit: 12,
    }),
    supabase.rpc("recent_brand_checklist_labels", {
      p_brand_id: content.brand_id,
      p_category: "preparation",
      p_limit: 12,
    }),
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
  const comments = (commentsRes.data ?? []) as Comment[];
  const lastReadAt = readRes.data?.last_comment_read_at ?? "1970-01-01T00:00:00Z";
  const checklistItems = (checklistItemsRes.data ?? []) as ChecklistItem[];
  const equipmentSuggestions = (suggEquipmentRes.data ?? []) as {
    label: string;
    usage_count: number;
  }[];
  const preparationSuggestions = (suggPreparationRes.data ?? []) as {
    label: string;
    usage_count: number;
  }[];
  const publications = (publicationsRes.data ?? []) as ContentPublication[];
  const scenePresets = (scenePresetsRes.data ?? []) as ScenePreset[];

  const c = content as Content;

  const tContent = await getTranslations("content");
  const tCommon = await getTranslations("common");
  const tStoryboard = await getTranslations("storyboard");
  const tStories = await getTranslations("stories");
  const tTabs = await getTranslations("tabs");
  const tType = await getTranslations("contentTypes");
  const tStatus = await getTranslations("statuses");

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

  return (
    <CommentsProvider
      contentId={c.id}
      currentUserId={user.id}
      initialComments={comments}
      initialLastReadAt={lastReadAt}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl-flip" />
            {tCommon("back")}
          </Link>
          <div className="flex items-center gap-2">
            <CommentsInboxButton />
            <ShareButton
              contentId={c.id}
              initialToken={c.share_token}
              initialMode={c.share_mode}
            />
            <Link
              href={`/print/${c.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold hover:bg-secondary"
            >
              <FileDown className="size-3.5" />
              {tContent("exportPdf")}
            </Link>
            <DeleteContentButton contentId={c.id} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <ColorDot color={typeColor(c.type)} />
            <span className="font-medium text-muted">
              {safeT(tType, c.type, typeLabel(c.type))}
            </span>
            <Badge
              className="ms-1 text-white"
              style={{ background: statusColor(c.status) }}
            >
              {safeT(tStatus, c.status, statusLabel(c.status))}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {c.title || tContent("untitled")}
          </h1>
        </div>

        <DetailTabs
          content={c}
          reel={reel}
          story={story}
          vlog={vlog}
          slides={slides}
          scenes={scenes}
          perf={perf}
          visuals={visuals}
          brandPillars={pillars}
          brandObjectives={objectives}
          checklistItems={checklistItems}
          equipmentSuggestions={equipmentSuggestions}
          preparationSuggestions={preparationSuggestions}
          publications={publications}
          scenePresets={scenePresets}
          brandId={content.brand_id}
        />
      </div>

      <CommentsDrawer targetLabels={targetLabels} />
    </CommentsProvider>
  );
}
