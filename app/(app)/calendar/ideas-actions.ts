"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveBrandId } from "@/lib/brand";
import { CONTENT_TYPES, isSimpleType } from "@/lib/constants";

type Result = { ok: true } | { ok: false; error: string };

/** Les colonnes du tableau des idées, dans l'ordre. */
const IDEA_LANES = ["idea", "selected", "writing"] as const;
export type IdeaLane = (typeof IDEA_LANES)[number];

/**
 * « En écriture » n'est pas un statut : c'est le moment où le contenu rejoint
 * son parcours normal. La valeur réelle dépend donc du format — `script` pour
 * une vidéo, `design` pour un post ou un carrousel. C'est ce qui évite
 * d'inventer un vocabulaire parallèle à celui de `lib/constants.ts`.
 */
function writingStatusFor(type: string | null): string {
  return isSimpleType(type) ? "design" : "script";
}

/**
 * Une idée jetée en deux secondes : un titre, rien d'autre.
 *
 * Pas de format, pas de date — c'est tout l'intérêt. Le format se choisit
 * quand on développe, la date quand on planifie.
 */
export async function createIdea(title: string): Promise<Result> {
  const clean = title.trim();
  if (!clean) return { ok: false, error: "Écris d'abord ton idée." };

  const brandId = await getActiveBrandId();
  if (!brandId) return { ok: false, error: "Aucune marque active." };

  const supabase = await createClient();
  // `user_id` est rempli par le trigger BEFORE INSERT (0002).
  const { error } = await supabase.from("contents").insert({
    brand_id: brandId,
    type: null,
    title: clean.slice(0, 300),
    status: "idea",
    date: null,
  });

  if (error) {
    if (error.message.includes("null value in column \"type\"")) {
      return {
        ok: false,
        error: "La migration 0055 n'a pas encore été exécutée dans Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/calendar");
  return { ok: true };
}

/**
 * Déplacer une carte d'une colonne à l'autre.
 *
 * Passer en « En écriture » exige un format : c'est précisément là qu'on
 * cesse de parler d'une idée. L'appelant doit donc l'avoir posé avant —
 * l'interface ouvre le choix du format sur ce geste.
 */
export async function moveIdea(
  contentId: string,
  lane: IdeaLane,
): Promise<Result> {
  if (!IDEA_LANES.includes(lane)) {
    return { ok: false, error: "Colonne inconnue." };
  }

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("contents")
    .select("id, type")
    .eq("id", contentId)
    .maybeSingle();

  if (!content) return { ok: false, error: "Contenu introuvable." };

  const type = (content as { type: string | null }).type;
  if (lane === "writing" && !type) {
    return {
      ok: false,
      error: "Choisis d'abord un format pour commencer à écrire.",
    };
  }

  const status = lane === "writing" ? writingStatusFor(type) : lane;
  const { error } = await supabase
    .from("contents")
    // `auto_status: false` comme partout ailleurs quand le statut est posé à
    // la main (0015) : on n'écrase pas une décision humaine.
    .update({ status, auto_status: false })
    .eq("id", contentId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/calendar");
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

/**
 * Sortir une idée du tableau et la poser dans le calendrier.
 *
 * Un seul geste pour format + plateforme + date, et ce n'est pas un raccourci
 * d'interface : la date ne vit plus sur `contents.date`, qui n'est qu'une
 * colonne de compatibilité réécrite par un trigger depuis les publications
 * (0020). Planifier, c'est donc créer une publication — qui exige une
 * plateforme, laquelle dépend du format. Les trois sont indissociables.
 */
export async function scheduleIdea(input: {
  contentId: string;
  /** Requis seulement si le contenu n'a pas encore de format. */
  type?: string;
  platform: string;
  date: string;
  time?: string | null;
}): Promise<Result> {
  if (!input.date) return { ok: false, error: "Choisis une date." };
  if (!input.platform) return { ok: false, error: "Choisis une plateforme." };

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("contents")
    .select("id, type, status")
    .eq("id", input.contentId)
    .maybeSingle();

  if (!content) return { ok: false, error: "Contenu introuvable." };
  const current = content as { type: string | null; status: string };

  // Poser le format s'il manque — même condition « seulement si vide » que
  // `setContentFormat`, portée par la requête plutôt que par un test préalable.
  let type = current.type;
  if (!type) {
    if (!input.type || !CONTENT_TYPES.some((t) => t.value === input.type)) {
      return { ok: false, error: "Choisis un format." };
    }
    const { error: typeError } = await supabase
      .from("contents")
      .update({ type: input.type })
      .eq("id", input.contentId)
      .is("type", null);
    if (typeError) return { ok: false, error: typeError.message };
    type = input.type;
  }

  const { error } = await supabase.from("content_publications").insert({
    content_id: input.contentId,
    platform: input.platform,
    scheduled_date: input.date,
    scheduled_time: input.time || null,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: `Ce contenu est déjà associé à ${input.platform}.`,
      };
    }
    return { ok: false, error: error.message };
  }

  // Une idée encore marquée « Idée » ou « Retenue » entre dans le parcours de
  // production : la laisser en « Retenue » alors qu'elle a une date rendrait
  // le calendrier incompréhensible.
  if (current.status === "idea" || current.status === "selected") {
    await supabase
      .from("contents")
      .update({ status: writingStatusFor(type), auto_status: false })
      .eq("id", input.contentId);
  }

  revalidatePath("/calendar");
  revalidatePath(`/content/${input.contentId}`);
  return { ok: true };
}
