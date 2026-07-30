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
  /** Marque explicite (ex : créer depuis la page d'une marque non-active). */
  brandId?: string;
  /** Thème de contenu à pré-remplir (ex : depuis un exemple d'un thème). */
  pillar?: string;
};

export async function createContent(input: CreateContentInput) {
  // Marque explicite prioritaire (RLS vérifie l'appartenance) ; sinon marque active.
  const brandId = input.brandId ?? (await getActiveBrandId());
  if (!brandId) return { error: "Aucune marque active." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  // user_id est rempli par le trigger BEFORE INSERT (migration 0002).
  const insertRow: Record<string, unknown> = {
    brand_id: brandId,
    type: input.type,
    title: input.title || null,
    date: input.date || null,
    platform: input.platform || null,
    status: "idea",
  };
  if (input.pillar?.trim()) {
    // Le trigger 0018 synchronise la colonne singulière `pillar` depuis pillars[0].
    insertRow.pillars = [input.pillar.trim()];
    insertRow.pillar = input.pillar.trim();
  }
  const { data, error } = await supabase
    .from("contents")
    .insert(insertRow)
    .select("id, type")
    .single();

  if (error) return { error: error.message };

  if (data.type === "reel") {
    await supabase.from("reel_details").insert({ content_id: data.id });
  } else if (data.type === "story") {
    await supabase.from("story_details").insert({ content_id: data.id });
  } else if (data.type === "vlog") {
    await supabase.from("vlog_details").insert({ content_id: data.id });
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
    pillars: string[];
    objectives: string[];
    hook: string | null;
    cta: string | null;
    status: string;
    tags: string[];
    video_url: string | null;
    caption: string | null;
  }>,
) {
  const supabase = await createClient();

  // Auto-status (0015) : si l'user change le statut manuellement on désactive
  // l'auto-progression pour cette vidéo (override perso). À l'inverse, si la
  // mutation ne touche pas le statut, on laisse auto_status tel qu'il est.
  const patchWithFlag =
    patch.status !== undefined ? { ...patch, auto_status: false } : patch;

  const { error } = await supabase
    .from("contents")
    .update(patchWithFlag)
    .eq("id", id);
  if (error) return { error: error.message };

  // Si la date a changé sans changement de statut, on recompute (la règle
  // editing → scheduled dépend de date > today).
  if (patch.date !== undefined && patch.status === undefined) {
    await supabase.rpc("recompute_content_status", { p_content_id: id });
  }

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

export async function deleteContentInPlace(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("contents").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function quickChangeStatus(id: string, status: string) {
  return updateContent(id, { status });
}

export async function duplicateContent(id: string) {
  const supabase = await createClient();

  const { data: src, error: e1 } = await supabase
    .from("contents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (e1 || !src) return { error: e1?.message ?? "Contenu introuvable." };

  const { data: newRow, error: e2 } = await supabase
    .from("contents")
    .insert({
      brand_id: src.brand_id,
      type: src.type,
      title: src.title ? `${src.title} (copie)` : "Copie sans titre",
      date: null,
      platform: src.platform,
      status: "idea",
      pillar: src.pillar,
      objective: src.objective,
      // Multi-piliers / multi-objectifs (Idée 8). Si l'arrière-plan
      // (migration 0018) n'est pas encore appliquée, src.pillars sera
      // undefined → on retombe sur tableau vide pour ne pas casser.
      pillars: src.pillars ?? [],
      objectives: src.objectives ?? [],
      hook: src.hook,
      cta: src.cta,
      tags: src.tags,
    })
    .select("id")
    .single();
  if (e2 || !newRow) return { error: e2?.message ?? "Erreur de duplication." };
  const newId = newRow.id as string;

  // Duplicate reel_details
  if (src.type === "reel") {
    const { data: rd } = await supabase
      .from("reel_details")
      .select("*")
      .eq("content_id", id)
      .maybeSingle();
    if (rd) {
      await supabase.from("reel_details").insert({
        content_id: newId,
        message_key: rd.message_key,
        intro: rd.intro,
        point1: rd.point1,
        point2: rd.point2,
        point3: rd.point3,
        transition: rd.transition,
        recap: rd.recap,
        outro: rd.outro,
        script_full: rd.script_full,
        checklist: {},
      });
    } else {
      await supabase.from("reel_details").insert({ content_id: newId });
    }

    // Duplicate storyboard_scenes (without image_url to avoid orphan references)
    const { data: scenes } = await supabase
      .from("storyboard_scenes")
      .select("scene_number, description, camera_angle, on_screen_text, tag")
      .eq("content_id", id);
    if (scenes && scenes.length) {
      await supabase.from("storyboard_scenes").insert(
        scenes.map((s) => ({ ...s, content_id: newId })),
      );
    }
  }

  // Duplicate checklist items (preserve label/category/position, reset `done`).
  // Marche pour les Reels ET les Stories.
  const { data: items } = await supabase
    .from("content_checklist_items")
    .select("category, label, position")
    .eq("content_id", id);
  if (items && items.length) {
    await supabase.from("content_checklist_items").insert(
      items.map((it) => ({
        ...it,
        content_id: newId,
        done: false,
      })),
    );
  }

  // Duplicate story_details + story_slides
  if (src.type === "story") {
    const { data: sd } = await supabase
      .from("story_details")
      .select("*")
      .eq("content_id", id)
      .maybeSingle();
    if (sd) {
      await supabase.from("story_details").insert({
        content_id: newId,
        objective: sd.objective,
        cta_soft: sd.cta_soft,
        format: sd.format,
      });
    }
    const { data: slides } = await supabase
      .from("story_slides")
      .select("slot_number, body")
      .eq("content_id", id);
    if (slides && slides.length) {
      await supabase.from("story_slides").insert(
        slides.map((s) => ({ ...s, content_id: newId })),
      );
    }
  }

  // Duplicate vlog_details (les moments à filmer sont déjà copiés par le bloc
  // checklist générique ci-dessus, catégorie 'capture' incluse).
  if (src.type === "vlog") {
    const { data: vd } = await supabase
      .from("vlog_details")
      .select("*")
      .eq("content_id", id)
      .maybeSingle();
    if (vd) {
      await supabase.from("vlog_details").insert({
        content_id: newId,
        angle: vd.angle,
        hook: vd.hook,
        arc_situation: vd.arc_situation,
        arc_development: vd.arc_development,
        arc_payoff: vd.arc_payoff,
        voiceover: vd.voiceover,
      });
    } else {
      await supabase.from("vlog_details").insert({ content_id: newId });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true, id: newId };
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

  // Idée 11 (revue UX) : Accroche et Outro sont maintenant édités UNIQUEMENT
  // dans l'onglet Script (intro / outro). Mais les consommateurs legacy
  // (share view, print, analytics, AI prompts qui lisent contents.hook/cta)
  // continuent à lire contents.hook et contents.cta. On les synchronise ici
  // pour ne rien casser pendant la transition. Suppression possible quand
  // on aura migré tous les readers.
  const legacySync: { hook?: string | null; cta?: string | null } = {};
  if (patch.intro !== undefined) {
    legacySync.hook = patch.intro?.trim() ? patch.intro : null;
  }
  if (patch.outro !== undefined) {
    legacySync.cta = patch.outro?.trim() ? patch.outro : null;
  }
  if (Object.keys(legacySync).length > 0) {
    await supabase.from("contents").update(legacySync).eq("id", contentId);
  }

  // Auto-status (0015) : si la checklist a bougé (script_ready, edited…),
  // on recompute. Les autres champs (intro, points…) n'impactent pas le
  // statut, donc on ne paie la RPC que quand c'est utile.
  if (patch.checklist !== undefined) {
    await supabase.rpc("recompute_content_status", { p_content_id: contentId });
  }

  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

export async function upsertVlogDetails(
  contentId: string,
  patch: Partial<{
    angle: string;
    hook: string;
    arc_situation: string;
    arc_development: string;
    arc_payoff: string;
    voiceover: string;
  }>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vlog_details")
    .upsert({ content_id: contentId, ...patch });
  if (error) return { error: error.message };

  // Le hook vit aussi sur contents (lu par share/print/analytics) — sync.
  if (patch.hook !== undefined) {
    await supabase
      .from("contents")
      .update({ hook: patch.hook?.trim() ? patch.hook : null })
      .eq("id", contentId);
  }

  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

export async function upsertStoryDetails(
  contentId: string,
  patch: Partial<{
    objective: string;
    cta_soft: string;
    format: string;
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

export async function upsertStorySlide(
  contentId: string,
  slotNumber: number,
  patch: Partial<{
    body: string | null;
    image_url: string | null;
    filmed: boolean;
  }>,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("story_slides")
    .upsert(
      { content_id: contentId, slot_number: slotNumber, ...patch },
      { onConflict: "content_id,slot_number" },
    );
  if (error) return { error: error.message };

  // Auto-status (0015) : si filmed a bougé, le statut peut passer
  // script → filming, ou filming → editing.
  if (patch.filmed !== undefined) {
    await supabase.rpc("recompute_content_status", { p_content_id: contentId });
  }

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
    image_url: string | null;
    filmed: boolean;
    editing_notes: string;
  }>,
  contentId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("storyboard_scenes")
    .update(patch)
    .eq("id", sceneId);
  if (error) return { error: error.message };

  // Auto-status (0015) : si filmed a bougé, le statut peut passer
  // script → filming, ou filming → editing.
  if (patch.filmed !== undefined) {
    await supabase.rpc("recompute_content_status", { p_content_id: contentId });
  }

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

/* ============================ Checklist items (V2 — migration 0011) ============================ */
// Items "matériel à prévoir" et "préparation tournage" gérés par video.
// Atomic actions : add / toggle / delete sont chacune une sauvegarde immédiate.

type ChecklistCategory = "equipment" | "preparation" | "capture";

export async function createChecklistItem(
  contentId: string,
  category: ChecklistCategory,
  label: string,
) {
  const trimmed = label.trim();
  if (!trimmed) return { error: "Le libellé est requis." };

  const supabase = await createClient();

  // Calcule la position max actuelle dans cette catégorie pour append à la fin.
  const { data: existing } = await supabase
    .from("content_checklist_items")
    .select("position")
    .eq("content_id", contentId)
    .eq("category", category)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { error } = await supabase.from("content_checklist_items").insert({
    content_id: contentId,
    category,
    label: trimmed,
    position: nextPosition,
  });
  if (error) return { error: error.message };

  revalidatePath(`/content/${contentId}`);
  return { ok: true as const };
}

export async function toggleChecklistItem(
  itemId: string,
  contentId: string,
  done: boolean,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_checklist_items")
    .update({ done })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true as const };
}

export async function deleteChecklistItem(itemId: string, contentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_checklist_items")
    .delete()
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true as const };
}

/**
 * Récupère les items les plus utilisés sur les 3 dernières vidéos de la
 * marque, pour les proposer en suggestion dans le composant "Ajouter un item".
 * Pas d'auth requise côté app — la RPC vérifie l'appartenance à la marque.
 */
export async function getRecentChecklistLabels(
  brandId: string,
  category: ChecklistCategory,
): Promise<{ label: string; usage_count: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recent_brand_checklist_labels", {
    p_brand_id: brandId,
    p_category: category,
    p_limit: 12,
  });
  if (error || !data) return [];
  return data as { label: string; usage_count: number }[];
}

/* ============================ Sharing ============================ */

export async function enableSharing(contentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enable_content_sharing", {
    p_content_id: contentId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true as const, token: data as string };
}

export async function disableSharing(contentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("disable_content_sharing", {
    p_content_id: contentId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true as const };
}

/**
 * Switch entre 'read' (lecture seule) et 'comment' (invités peuvent commenter).
 * Utilisé par le toggle dans le ShareButton dialog. Migration 0012.
 */
export async function updateShareMode(
  contentId: string,
  mode: "read" | "comment",
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_share_mode", {
    p_content_id: contentId,
    p_mode: mode,
  });
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true as const };
}

/* ============================ Reordering ============================ */

export async function reorderScenes(
  contentId: string,
  orderedIds: string[],
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_storyboard_scenes", {
    p_content_id: contentId,
    p_ordered_ids: orderedIds,
  });
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true as const };
}

export async function swapSlides(
  contentId: string,
  slotA: number,
  slotB: number,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("swap_story_slides", {
    p_content_id: contentId,
    p_slot_a: slotA,
    p_slot_b: slotB,
  });
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true as const };
}

/* =========================================================================
   Publications multi-plateformes (Idée 10, migration 0020)
   ========================================================================= */

/**
 * Ajoute une publication pour un contenu sur une plateforme donnée.
 * Erreur si la plateforme est déjà liée à ce contenu (unique constraint).
 */
export async function addPublication(input: {
  contentId: string;
  platform: string;
  scheduledDate?: string | null;
  url?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("content_publications").insert({
    content_id: input.contentId,
    platform: input.platform,
    scheduled_date: input.scheduledDate ?? null,
    url: input.url ?? null,
  });
  if (error) {
    // 23505 = unique_violation côté Postgres
    if (error.code === "23505") {
      return {
        error: `Cette vidéo est déjà associée à ${input.platform}.`,
      };
    }
    return { error: error.message };
  }
  revalidatePath(`/content/${input.contentId}`);
  revalidatePath("/calendar");
  return { ok: true as const };
}

/**
 * Met à jour une publication (changement de plateforme, date, URL).
 */
export async function updatePublication(
  publicationId: string,
  patch: Partial<{
    platform: string;
    scheduled_date: string | null;
    url: string | null;
  }>,
  contentId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_publications")
    .update(patch)
    .eq("id", publicationId);
  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "Une publication existe déjà pour cette plateforme sur cette vidéo.",
      };
    }
    return { error: error.message };
  }
  revalidatePath(`/content/${contentId}`);
  revalidatePath("/calendar");
  return { ok: true as const };
}

/**
 * Supprime une publication. Le trigger côté DB resync automatiquement
 * les colonnes legacy contents.platform / date / video_url sur la
 * publication primaire restante (ou les clear si plus aucune).
 */
export async function removePublication(
  publicationId: string,
  contentId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_publications")
    .delete()
    .eq("id", publicationId);
  if (error) return { error: error.message };
  revalidatePath(`/content/${contentId}`);
  revalidatePath("/calendar");
  return { ok: true as const };
}

/* =========================================================================
   Bibliothèque de setups de scène (Storyboard Lot 2, migration 0021)
   ========================================================================= */

/**
 * Crée un setup réutilisable pour une marque. Utilisé soit "en avance"
 * (dialog création depuis le storyboard), soit "au vol" (enregistrer une
 * scène existante comme setup).
 */
export async function createScenePreset(input: {
  brandId: string;
  label: string;
  referenceImageUrl?: string | null;
  defaultCamera?: string | null;
  defaultEditingNotes?: string | null;
}) {
  const label = input.label.trim();
  if (!label) return { error: "Le nom du setup est requis." };
  if (label.length > 60) return { error: "Nom trop long (60 caractères max)." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("brand_scene_presets")
    .select("position")
    .eq("brand_id", input.brandId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? 0) + 1;

  const { error } = await supabase.from("brand_scene_presets").insert({
    brand_id: input.brandId,
    label,
    reference_image_url: input.referenceImageUrl ?? null,
    default_camera: input.defaultCamera ?? null,
    default_editing_notes: input.defaultEditingNotes ?? null,
    position: nextPos,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Supprime un setup de la bibliothèque de la marque. Ne touche pas aux
 * scènes déjà créées à partir de ce setup (elles ont leur propre copie).
 */
export async function deleteScenePreset(presetId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_scene_presets")
    .delete()
    .eq("id", presetId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Insère une nouvelle scène dans un storyboard à partir d'un setup :
 * copie l'image de réf + le cadrage + les notes de montage du preset.
 * L'utilisateur n'a plus qu'à taper le dialogue.
 */
export async function addSceneFromPreset(input: {
  contentId: string;
  presetId: string;
}) {
  const supabase = await createClient();

  // 1. Charge le preset (RLS valide l'accès marque)
  const { data: preset, error: e1 } = await supabase
    .from("brand_scene_presets")
    .select("reference_image_url, default_camera, default_editing_notes")
    .eq("id", input.presetId)
    .maybeSingle();
  if (e1 || !preset) return { error: "Setup introuvable." };

  // 2. Calcule le prochain numéro de scène
  const { data: existing } = await supabase
    .from("storyboard_scenes")
    .select("scene_number")
    .eq("content_id", input.contentId)
    .order("scene_number", { ascending: false })
    .limit(1);
  const nextNumber = (existing?.[0]?.scene_number ?? 0) + 1;

  // 3. Insère la scène pré-remplie depuis le preset
  const { error: e2 } = await supabase.from("storyboard_scenes").insert({
    content_id: input.contentId,
    scene_number: nextNumber,
    image_url: preset.reference_image_url,
    camera_angle: preset.default_camera,
    editing_notes: preset.default_editing_notes,
  });
  if (e2) return { error: e2.message };

  revalidatePath(`/content/${input.contentId}`);
  return { ok: true as const };
}
