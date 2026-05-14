"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateReel, generateStory, AiError } from "@/lib/ai";

export async function aiGenerateReel(input: {
  contentId: string;
  topic: string;
  audience?: string;
  platform?: string;
  apply: boolean; // true = save to DB; false = preview only
}) {
  try {
    const result = await generateReel({
      topic: input.topic,
      audience: input.audience,
      platform: input.platform,
    });

    if (input.apply) {
      const supabase = await createClient();
      await supabase.from("reel_details").upsert({
        content_id: input.contentId,
        intro: result.intro,
        point1: result.point1,
        point2: result.point2,
        point3: result.point3,
        transition: result.transition,
        recap: result.recap,
        outro: result.outro,
      });
      // Hook + CTA vivent dans contents (champs partagés)
      await supabase
        .from("contents")
        .update({ hook: result.hook, cta: result.cta })
        .eq("id", input.contentId);
      revalidatePath(`/content/${input.contentId}`);
    }

    return { ok: true as const, data: result };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

export async function aiGenerateStory(input: {
  contentId: string;
  topic: string;
  audience?: string;
  apply: boolean;
}) {
  try {
    const result = await generateStory({
      topic: input.topic,
      audience: input.audience,
    });

    if (input.apply) {
      const supabase = await createClient();

      await supabase.from("story_details").upsert({
        content_id: input.contentId,
        objective: result.objective,
        cta_soft: result.cta_soft,
      });

      // Upsert chaque slide
      for (const s of result.slides) {
        await supabase.from("story_slides").upsert(
          { content_id: input.contentId, slot_number: s.slot, body: s.body },
          { onConflict: "content_id,slot_number" },
        );
      }

      revalidatePath(`/content/${input.contentId}`);
    }

    return { ok: true as const, data: result };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}
