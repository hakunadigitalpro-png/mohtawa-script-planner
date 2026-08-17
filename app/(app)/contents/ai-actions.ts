"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guardAiAction } from "@/lib/ai-guard";
import {
  generateReel,
  generateStory,
  generateAutopsy,
  generateVlog,
  transcribeWithGroq,
  analyzeReferenceVideo,
  segmentScriptIntoStoryboard,
  AiError,
  type GenerationLanguage,
  type ScenePresetHint,
  type StoryboardSceneGeneration,
} from "@/lib/ai";
import type { FilmingGuide } from "@/lib/types";

/**
 * Setups réutisables (Mes setups) de la marque du contenu, avec leur
 * matériel propre (0051 — le matériel vit sur CHAQUE setup, pas sur la
 * marque : deux setups peuvent avoir un matériel complètement différent).
 * Nourrit le découpage storyboard ; absence gérée sans planter côté prompt
 * (blocs conditionnels).
 */
async function getBrandScenePresets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentId: string,
): Promise<ScenePresetHint[]> {
  const { data: content } = await supabase
    .from("contents")
    .select("brand_id")
    .eq("id", contentId)
    .maybeSingle();
  if (!content) return [];

  const { data: presetRows } = await supabase
    .from("brand_scene_presets")
    .select("label, default_camera, default_editing_notes, equipment")
    .eq("brand_id", content.brand_id)
    .order("position", { ascending: true });

  return (presetRows ?? []).map((p) => ({
    label: p.label,
    hint: [p.default_camera, p.default_editing_notes]
      .filter((s): s is string => Boolean(s?.trim()))
      .join(" · ") || undefined,
    equipment: p.equipment?.trim() || undefined,
  }));
}

/**
 * Map "label de setup en minuscules" → photo de référence, pour résoudre
 * les `preset_label` renvoyés par l'IA au moment d'ENREGISTRER les scènes
 * (étape séparée de la génération — on retrouve simplement au vol le setup
 * correspondant plutôt que de faire transiter les URLs via le client).
 */
async function getPresetImageByLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentId: string,
): Promise<Map<string, string>> {
  const { data: content } = await supabase
    .from("contents")
    .select("brand_id")
    .eq("id", contentId)
    .maybeSingle();
  const map = new Map<string, string>();
  if (!content) return map;

  const { data: presets } = await supabase
    .from("brand_scene_presets")
    .select("label, reference_image_url")
    .eq("brand_id", content.brand_id);
  for (const p of presets ?? []) {
    if (p.reference_image_url) map.set(p.label.trim().toLowerCase(), p.reference_image_url);
  }
  return map;
}

function resolveSceneImage(
  scene: Pick<StoryboardSceneGeneration, "preset_label">,
  presetImages: Map<string, string>,
): string | null {
  if (!scene.preset_label) return null;
  return presetImages.get(scene.preset_label.trim().toLowerCase()) ?? null;
}

/**
 * Génère un script de Reel simplifié (Accroche / Corps / Outro) via Claude.
 * NE PERSISTE PAS — renvoie le preview. L'application passe par
 * applyReelGeneration (pas de 2e appel IA → on ne paie qu'une fois).
 */
export async function aiGenerateReel(input: {
  contentId: string;
  topic: string;
  audience?: string;
  platform?: string;
  includeStoryboard?: boolean;
  language?: GenerationLanguage;
}) {
  try {
    const { supabase } = await guardAiAction("reel");
    const presets = input.includeStoryboard
      ? await getBrandScenePresets(supabase, input.contentId)
      : [];
    const data = await generateReel({
      topic: input.topic,
      audience: input.audience,
      platform: input.platform,
      includeStoryboard: input.includeStoryboard,
      language: input.language,
      presets,
    });
    return { ok: true as const, data };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

/**
 * Persiste un script de Reel généré (déjà prévisualisé) : Accroche → intro,
 * Corps → script_full, Outro → outro. Sync hook/cta sur contents (lus par
 * share/print/analytics).
 *
 * Si `storyboard` est fourni (migration 0047) : NON-DESTRUCTIF. On ne crée
 * les scènes + le résumé de tournage QUE si le storyboard est encore
 * entièrement vide (aucune scène, pas de résumé déjà enregistré) — sinon on
 * laisse tel quel ce que l'utilisatrice a déjà retouché à la main (photos,
 * "filmé", ordre...) et on le signale via `storyboardSkipped`.
 */
export async function applyReelGeneration(input: {
  contentId: string;
  accroche: string;
  corps: string;
  outro: string;
  storyboard?: {
    scenes: StoryboardSceneGeneration[];
    filming_guide: FilmingGuide;
  };
}) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("reel_details").upsert({
      content_id: input.contentId,
      intro: input.accroche,
      script_full: input.corps,
      outro: input.outro,
    });
    if (error) return { ok: false as const, error: error.message };

    await supabase
      .from("contents")
      .update({
        hook: input.accroche?.trim() ? input.accroche : null,
        cta: input.outro?.trim() ? input.outro : null,
      })
      .eq("id", input.contentId);

    let storyboardSkipped = false;
    if (input.storyboard) {
      const [{ count: sceneCount }, { data: existingReel }] =
        await Promise.all([
          supabase
            .from("storyboard_scenes")
            .select("id", { count: "exact", head: true })
            .eq("content_id", input.contentId),
          supabase
            .from("reel_details")
            .select("filming_guide")
            .eq("content_id", input.contentId)
            .maybeSingle(),
        ]);
      const storyboardIsEmpty =
        !sceneCount && !existingReel?.filming_guide;

      if (storyboardIsEmpty) {
        const presetImages = await getPresetImageByLabel(
          supabase,
          input.contentId,
        );
        const scenesToInsert = input.storyboard.scenes.map((s, i) => ({
          content_id: input.contentId,
          scene_number: i + 1,
          description: s.description,
          camera_angle: s.camera_angle,
          expression: s.expression,
          movement: s.movement,
          image_url: resolveSceneImage(s, presetImages),
        }));
        if (scenesToInsert.length) {
          await supabase.from("storyboard_scenes").insert(scenesToInsert);
        }
        await supabase
          .from("reel_details")
          .update({ filming_guide: input.storyboard.filming_guide })
          .eq("content_id", input.contentId);
      } else {
        storyboardSkipped = true;
      }
    }

    revalidatePath(`/content/${input.contentId}`);
    return { ok: true as const, storyboardSkipped };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

/**
 * Découpe un script DÉJÀ ÉCRIT (Guidé ou Libre) en storyboard, sans le
 * regénérer. NE PERSISTE PAS — renvoie le preview, comme les autres
 * générations. Bucket de rate-limit dédié ("storyboard") pour ne pas
 * consommer le quota "reel".
 */
export async function aiSegmentStoryboard(input: {
  contentId: string;
  script: string;
}) {
  try {
    const { supabase } = await guardAiAction("storyboard");
    const presets = await getBrandScenePresets(supabase, input.contentId);
    const data = await segmentScriptIntoStoryboard({
      script: input.script,
      presets,
    });
    return { ok: true as const, data };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

/**
 * Persiste un découpage de storyboard déjà prévisualisé. Même garde
 * non-destructive que dans applyReelGeneration : n'écrit QUE si le
 * storyboard est encore entièrement vide, sinon signale `skipped` sans
 * toucher à ce que l'utilisatrice a déjà rempli à la main.
 */
export async function applyStoryboardSegmentation(input: {
  contentId: string;
  scenes: StoryboardSceneGeneration[];
  filming_guide: FilmingGuide;
}) {
  try {
    const supabase = await createClient();

    const [{ count: sceneCount }, { data: existingReel }] = await Promise.all([
      supabase
        .from("storyboard_scenes")
        .select("id", { count: "exact", head: true })
        .eq("content_id", input.contentId),
      supabase
        .from("reel_details")
        .select("filming_guide")
        .eq("content_id", input.contentId)
        .maybeSingle(),
    ]);
    const storyboardIsEmpty = !sceneCount && !existingReel?.filming_guide;

    if (!storyboardIsEmpty) {
      return { ok: true as const, skipped: true };
    }

    const presetImages = await getPresetImageByLabel(supabase, input.contentId);
    const scenesToInsert = input.scenes.map((s, i) => ({
      content_id: input.contentId,
      scene_number: i + 1,
      description: s.description,
      camera_angle: s.camera_angle,
      expression: s.expression,
      movement: s.movement,
      image_url: resolveSceneImage(s, presetImages),
    }));
    if (scenesToInsert.length) {
      const { error } = await supabase
        .from("storyboard_scenes")
        .insert(scenesToInsert);
      if (error) return { ok: false as const, error: error.message };
    }
    await supabase
      .from("reel_details")
      .upsert({ content_id: input.contentId, filming_guide: input.filming_guide });

    revalidatePath(`/content/${input.contentId}`);
    return { ok: true as const, skipped: false };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

/**
 * Génère une séquence de Story (5 slides) via Claude. NE PERSISTE PAS —
 * renvoie le preview ; l'application passe par applyStoryGeneration.
 */
export async function aiGenerateStory(input: {
  contentId: string;
  topic: string;
  audience?: string;
  language?: GenerationLanguage;
}) {
  try {
    await guardAiAction("story");
    const data = await generateStory({
      topic: input.topic,
      audience: input.audience,
      language: input.language,
    });
    return { ok: true as const, data };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

/**
 * Persiste une séquence de Story générée (déjà prévisualisée) : objectif +
 * cta_soft dans story_details, et le body de chaque slide dans story_slides.
 */
export async function applyStoryGeneration(input: {
  contentId: string;
  objective: string;
  cta_soft: string;
  slides: { slot: number; body: string }[];
}) {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("story_details").upsert({
      content_id: input.contentId,
      objective: input.objective,
      cta_soft: input.cta_soft,
    });
    if (error) return { ok: false as const, error: error.message };

    for (const s of input.slides) {
      await supabase.from("story_slides").upsert(
        { content_id: input.contentId, slot_number: s.slot, body: s.body },
        { onConflict: "content_id,slot_number" },
      );
    }

    revalidatePath(`/content/${input.contentId}`);
    return { ok: true as const };
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
    const { supabase } = await guardAiAction("autopsy");

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

    // Signe les chemins du bucket privé `insights` → URLs temporaires (10 min)
    // que Claude peut aller lire. Les valeurs legacy `http…` (anciennes
    // captures publiques) passent telles quelles.
    const signedForAi: string[] = [];
    for (const p of images) {
      if (p.startsWith("http")) {
        signedForAi.push(p);
        continue;
      }
      const { data: signed } = await supabase.storage
        .from("insights")
        .createSignedUrl(p, 600);
      if (signed?.signedUrl) signedForAi.push(signed.signedUrl);
    }

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
      insightsImageUrls: signedForAi,
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

/**
 * Génère un plan de vlog (angle, hooks, arc, moments à filmer, voix-off,
 * légende) via Claude. NE PERSISTE PAS — renvoie le preview. L'application
 * passe par applyVlogGeneration (pas de second appel IA → on ne paie qu'une
 * fois, et l'user applique exactement ce qu'il a vu).
 */
export async function aiGenerateVlog(input: {
  contentId: string;
  topic: string;
  audience?: string;
  platform?: string;
}) {
  try {
    await guardAiAction("vlog");
    const data = await generateVlog({
      topic: input.topic,
      audience: input.audience,
      platform: input.platform,
    });
    return { ok: true as const, data };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

/**
 * Persiste un plan de vlog généré (déjà prévisualisé côté client) :
 *   - vlog_details : angle + hook choisi + arc + voix-off
 *   - contents.caption + contents.hook (legacy/partagés)
 *   - les moments à filmer → content_checklist_items catégorie 'capture'
 *     (n'ajoute que les libellés pas encore présents → pas de doublon si
 *     l'user régénère).
 */
export async function applyVlogGeneration(input: {
  contentId: string;
  angle: string;
  hook: string;
  arc: { situation: string; development: string; payoff: string };
  voiceover: string;
  caption: string;
  captureShots: string[];
}) {
  try {
    const supabase = await createClient();

    const { error: e1 } = await supabase.from("vlog_details").upsert({
      content_id: input.contentId,
      angle: input.angle,
      hook: input.hook,
      arc_situation: input.arc.situation,
      arc_development: input.arc.development,
      arc_payoff: input.arc.payoff,
      voiceover: input.voiceover,
    });
    if (e1) return { ok: false as const, error: e1.message };

    // Hook + caption vivent aussi sur contents (lus par share/print/analytics).
    await supabase
      .from("contents")
      .update({
        caption: input.caption?.trim() ? input.caption : null,
        hook: input.hook?.trim() ? input.hook : null,
      })
      .eq("id", input.contentId);

    // Moments à filmer → checklist de capture (append des nouveaux uniquement).
    const shots = input.captureShots.map((s) => s.trim()).filter(Boolean);
    if (shots.length) {
      const { data: existing } = await supabase
        .from("content_checklist_items")
        .select("label, position")
        .eq("content_id", input.contentId)
        .eq("category", "capture");
      const existingLabels = new Set(
        (existing ?? []).map((it) => it.label.trim().toLowerCase()),
      );
      let pos = (existing ?? []).reduce(
        (m, it) => Math.max(m, it.position),
        -1,
      );
      const toInsert = shots
        .filter((s) => !existingLabels.has(s.toLowerCase()))
        .map((label) => ({
          content_id: input.contentId,
          category: "capture",
          label,
          position: ++pos,
        }));
      if (toInsert.length) {
        await supabase.from("content_checklist_items").insert(toInsert);
      }
    }

    revalidatePath(`/content/${input.contentId}`);
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

/**
 * Analyse une vidéo de référence pour s'en inspirer. La vidéo est uploadée
 * côté client sur Supabase Storage (URL publique) ; ici Groq la transcrit,
 * puis Claude décortique le wording et propose un script. Résultat renvoyé
 * (non persisté — outil à la demande pour le moment).
 */
export async function analyzeReferenceVideoAction(input: {
  contentId: string;
  videoUrl: string;
  filename?: string;
}) {
  try {
    const { supabase } = await guardAiAction("reference");

    // Contexte (plateforme + marque) pour adapter le script proposé.
    const { data: content } = await supabase
      .from("contents")
      .select("platform, brand_id, title")
      .eq("id", input.contentId)
      .maybeSingle();

    let brandContext: string | null = content?.title
      ? `Vidéo en préparation : "${content.title}"`
      : null;
    if (content?.brand_id) {
      const { data: brand } = await supabase
        .from("brands")
        .select("name")
        .eq("id", content.brand_id)
        .maybeSingle();
      if (brand?.name) {
        brandContext = `Marque : ${brand.name}${
          content?.title ? ` — vidéo en préparation : "${content.title}"` : ""
        }`;
      }
    }

    const transcript = await transcribeWithGroq(
      input.videoUrl,
      input.filename,
    );
    const analysis = await analyzeReferenceVideo({
      transcript,
      platform: content?.platform ?? null,
      brandContext,
    });

    return { ok: true as const, analysis, transcript };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}
