"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveBrandId } from "@/lib/brand";

type CreateContentInput = {
  type: string;
  title?: string;
  date?: string | null;
  platform?: string | null;
};

export async function createContent(input: CreateContentInput) {
  const brandId = await getActiveBrandId();
  if (!brandId) return { error: "Aucune marque active." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  // user_id est rempli par le trigger BEFORE INSERT (migration 0002).
  const { data, error } = await supabase
    .from("contents")
    .insert({
      brand_id: brandId,
      type: input.type,
      title: input.title || null,
      date: input.date || null,
      platform: input.platform || null,
      status: "idea",
    })
    .select("id, type")
    .single();

  if (error) return { error: error.message };

  if (data.type === "reel") {
    await supabase.from("reel_details").insert({ content_id: data.id });
  } else if (data.type === "story") {
    await supabase.from("story_details").insert({ content_id: data.id });
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  redirect(`/content/${data.id}`);
}

export async function updateContent(
  id: string,
  patch: Partial<{
    title: string;
    date: string | null;
    platform: string | null;
    pillar: string | null;
    objective: string | null;
    hook: string | null;
    cta: string | null;
    status: string;
    tags: string[];
  }>,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("contents").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/content/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function deleteContent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contents").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  redirect("/dashboard");
}

export async function upsertReelDetails(
  contentId: string,
  patch: Partial<{
    message_key: string;
    intro: string;
    point1: string;
    point2: string;
    point3: string;
    transition: string;
    recap: string;
    outro: string;
    script_full: string;
    checklist: Record<string, boolean>;
  }>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reel_details")
    .upsert({ content_id: contentId, ...patch });
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

export async function upsertStoryDetails(
  contentId: string,
  patch: Partial<{
    objective: string;
    cta_soft: string;
    format: string;
    story1: string;
    story2: string;
    story3: string;
    story4: string;
    story5: string;
  }>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("story_details")
    .upsert({ content_id: contentId, ...patch });
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

export async function upsertPerformance(
  contentId: string,
  patch: Partial<{
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    retention: number;
    notes: string;
  }>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("performances")
    .upsert({ content_id: contentId, ...patch });
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

export async function addScene(contentId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("storyboard_scenes")
    .select("scene_number")
    .eq("content_id", contentId)
    .order("scene_number", { ascending: false })
    .limit(1);
  const nextNumber = (existing?.[0]?.scene_number ?? 0) + 1;

  const { error } = await supabase.from("storyboard_scenes").insert({
    content_id: contentId,
    scene_number: nextNumber,
  });
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

export async function updateScene(
  sceneId: string,
  patch: Partial<{
    description: string;
    camera_angle: string;
    on_screen_text: string;
    tag: string;
  }>,
  contentId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("storyboard_scenes")
    .update(patch)
    .eq("id", sceneId);
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

export async function deleteScene(sceneId: string, contentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("storyboard_scenes")
    .delete()
    .eq("id", sceneId);
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}
