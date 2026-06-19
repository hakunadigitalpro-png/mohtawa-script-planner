"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  generateReel,
  generateStory,
  generateSceneImage,
  generateAutopsy,
  AiError,
} from "@/lib/ai";

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
      // Script simplifié (Accroche / Corps / Outro) : on plie le corps généré
      // (points + transition + récap) dans script_full = le champ "Corps"
      // réellement affiché. On garde aussi les colonnes détaillées en base.
      const corps = [
        result.point1,
        result.point2,
        result.point3,
        result.transition,
        result.recap,
      ]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join("\n\n");
      await supabase.from("reel_details").upsert({
        content_id: input.contentId,
        intro: result.intro,
        point1: result.point1,
        point2: result.point2,
        point3: result.point3,
        transition: result.transition,
        recap: result.recap,
        outro: result.outro,
        script_full: corps,
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

/**
 * Génère une image IA pour une scène storyboard à partir d'un prompt
 * fourni directement par l'utilisateur (depuis le dialog "Générer image
 * IA"). On ne lit PAS la scène en DB pour éviter le piège des champs
 * dirty pas encore sauvés — l'utilisateur tape sa description dans le
 * dialog et c'est cette valeur qui part à DALL-E.
 *
 * DL le résultat de chez OpenAI (URL temporaire 60min), l'upload sur
 * Supabase Storage, puis met à jour scene.image_url. Chaque génération
 * crée un nouveau fichier avec timestamp.
 *
 * Coût ~0.08 $ par image (DALL-E 3 1792x1024 standard).
 */
export async function aiGenerateSceneImage(input: {
  sceneId: string;
  contentId: string;
  /** Description libre tapée par l'user dans le dialog. C'est CE texte qui part à DALL-E. */
  description: string;
  /** Optionnel : angle/placement caméra additionnel pour préciser le shooting. */
  cameraNote?: string;
}) {
  try {
    const supabase = await createClient();

    if (!input.description || !input.description.trim()) {
      return {
        ok: false as const,
        error: "Tape une description avant de générer.",
      };
    }

    // 1. Appel DALL-E 3 avec le prompt fourni par l'user
    const gen = await generateSceneImage({
      description: input.description,
      cameraAngle: input.cameraNote,
    });

    // 2. Télécharge l'image depuis l'URL OpenAI (valide ~60min seulement)
    const imgRes = await fetch(gen.url);
    if (!imgRes.ok) {
      return {
        ok: false as const,
        error: "Téléchargement de l'image depuis OpenAI échoué.",
      };
    }
    const imgBuf = new Uint8Array(await imgRes.arrayBuffer());

    // 3. Upload dans Supabase Storage avec un nom de fichier unique
    // (timestamp pour éviter collision avec uploads manuels et régénérations)
    const fileName = `${input.contentId}/${input.sceneId}-ai-${Date.now()}.png`;
    const { error: e2 } = await supabase.storage
      .from("content-media")
      .upload(fileName, imgBuf, {
        contentType: "image/png",
        upsert: false,
      });
    if (e2) {
      return {
        ok: false as const,
        error: `Upload Supabase Storage échoué : ${e2.message}`,
      };
    }

    // 4. URL publique
    const { data: pub } = supabase.storage
      .from("content-media")
      .getPublicUrl(fileName);
    const publicUrl = pub.publicUrl;

    // 5. Met à jour la scène
    const { error: e3 } = await supabase
      .from("storyboard_scenes")
      .update({ image_url: publicUrl })
      .eq("id", input.sceneId);
    if (e3) {
      return {
        ok: false as const,
        error: `Mise à jour de la scène échouée : ${e3.message}`,
      };
    }

    revalidatePath(`/content/${input.contentId}`);
    return { ok: true as const, imageUrl: publicUrl };
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

/**
 * Génère l'autopsie IA d'une vidéo (API Claude). Sauve d'abord le
 * transcript + les notes de rétention fournis par le client (pas de
 * dépendance à un Save préalable → évite le piège du state dirty), puis
 * appelle Claude et stocke le résultat dans performances.autopsy_md.
 */
export async function generateVideoAutopsy(input: {
  contentId: string;
  transcript: string;
  insightsImageUrls?: string[];
}) {
  try {
    const supabase = await createClient();

    // 1. Charge le content (titre, plateforme) + les stats existantes
    const { data: content } = await supabase
      .from("contents")
      .select("title, platform")
      .eq("id", input.contentId)
      .maybeSingle();
    if (!content) return { ok: false as const, error: "Vidéo introuvable." };

    const { data: perf } = await supabase
      .from("performances")
      .select("views, likes, comments, shares, saves, retention")
      .eq("content_id", input.contentId)
      .maybeSingle();

    const images = (input.insightsImageUrls ?? []).filter(Boolean);

    // 2. Persiste les inputs d'autopsie (transcript + captures)
    const { error: saveErr } = await supabase.from("performances").upsert({
      content_id: input.contentId,
      transcript: input.transcript.trim() || null,
      insights_image_urls: images,
    });
    if (saveErr) return { ok: false as const, error: saveErr.message };

    // 3. Appel Claude
    const autopsy = await generateAutopsy({
      title: content.title ?? "",
      platform: content.platform ?? null,
      stats: {
        views: perf?.views ?? null,
        likes: perf?.likes ?? null,
        comments: perf?.comments ?? null,
        shares: perf?.shares ?? null,
        saves: perf?.saves ?? null,
        retention: perf?.retention ?? null,
      },
      transcript: input.transcript,
      insightsImageUrls: images,
    });

    // 4. Stocke le résultat + l'horodatage
    const { error: updErr } = await supabase
      .from("performances")
      .update({ autopsy_md: autopsy, autopsy_at: new Date().toISOString() })
      .eq("content_id", input.contentId);
    if (updErr) return { ok: false as const, error: updErr.message };

    revalidatePath(`/content/${input.contentId}`);
    return { ok: true as const, autopsy };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}
