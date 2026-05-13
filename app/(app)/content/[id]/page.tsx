import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import type {
  Content,
  ReelDetails,
  StoryDetails,
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

  const [reelRes, storyRes, scenesRes, perfRes] = await Promise.all([
    supabase.from("reel_details").select("*").eq("content_id", id).maybeSingle(),
    supabase.from("story_details").select("*").eq("content_id", id).maybeSingle(),
    supabase
      .from("storyboard_scenes")
      .select("*")
      .eq("content_id", id)
      .order("scene_number", { ascending: true }),
    supabase.from("performances").select("*").eq("content_id", id).maybeSingle(),
  ]);

  const reel = (reelRes.data ?? null) as ReelDetails | null;
  const story = (storyRes.data ?? null) as StoryDetails | null;
  const scenes = (scenesRes.data ?? []) as StoryboardScene[];
  const perf = (perfRes.data ?? null) as Performance | null;

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
        <DeleteContentButton contentId={c.id} />
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
        <h1 className="text-2xl font-semibold tracking-tight">
          {c.title || "Sans titre"}
        </h1>
      </div>

      <DetailTabs
        content={c}
        reel={reel}
        story={story}
        scenes={scenes}
        perf={perf}
      />
    </div>
  );
}
