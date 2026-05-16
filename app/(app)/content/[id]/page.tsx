import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
import type {
  Content,
  ReelDetails,
  StoryDetails,
  StorySlide,
  StoryboardScene,
  Performance,
} from "@/lib/types";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!content) notFound();

  const [reelRes, storyRes, slidesRes, scenesRes, perfRes, pillarsRes, objectivesRes] = await Promise.all([
    supabase.from("reel_details").select("*").eq("content_id", id).maybeSingle(),
    supabase.from("story_details").select("*").eq("content_id", id).maybeSingle(),
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
      .select("id, name")
      .eq("brand_id", content.brand_id)
      .order("position", { ascending: true }),
    supabase
      .from("brand_objectives")
      .select("id, name")
      .eq("brand_id", content.brand_id)
      .order("position", { ascending: true }),
  ]);

  const reel = (reelRes.data ?? null) as ReelDetails | null;
  const story = (storyRes.data ?? null) as StoryDetails | null;
  const slides = (slidesRes.data ?? []) as StorySlide[];
  const scenes = (scenesRes.data ?? []) as StoryboardScene[];
  const perf = (perfRes.data ?? null) as Performance | null;
  const pillars = (pillarsRes.data ?? []) as { id: string; name: string }[];
  const objectives = (objectivesRes.data ?? []) as { id: string; name: string }[];

  const c = content as Content;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour
        </Link>
        <div className="flex items-center gap-2">
          <ShareButton contentId={c.id} initialToken={c.share_token} />
          <Link
            href={`/print/${c.id}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold hover:bg-secondary"
          >
            <FileDown className="size-3.5" />
            Exporter PDF
          </Link>
          <DeleteContentButton contentId={c.id} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <ColorDot color={typeColor(c.type)} />
          <span className="font-medium text-muted">{typeLabel(c.type)}</span>
          <Badge
            className="ml-1 text-white"
            style={{ background: statusColor(c.status) }}
          >
            {statusLabel(c.status)}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {c.title || "Sans titre"}
        </h1>
      </div>

      <DetailTabs
        content={c}
        reel={reel}
        story={story}
        slides={slides}
        scenes={scenes}
        perf={perf}
        brandPillars={pillars}
        brandObjectives={objectives}
      />
    </div>
  );
}
