"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guardAiAction } from "@/lib/ai-guard";
import { getBrandKitContext } from "@/lib/brand-kit-context";
import { AiError, type GenerationLanguage } from "@/lib/ai";
import {
  findExtracts,
  planLongform,
  writeLongformPart,
  type LongformContext,
  type PlannedPart,
} from "@/lib/ai-longform";
import { isLongformType } from "@/lib/constants";
import { applyWritingProgress } from "@/lib/content-lifecycle-db";
import {
  MAX_PARTS,
  MAX_TRANSCRIPT_CHARS,
  isExtractType,
  quoteIsInSource,
  sectionsToText,
  MAX_REWRITE_WORDS,
  countWords,
  type ExtractProposal,
  type LongformPart,
  type LongformType,
} from "@/lib/longform";
import { createContentRow, upsertReelDetails, updateContent } from "./actions";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type LongContent = {
  id: string;
  type: LongformType;
  title: string | null;
  brand_id: string;
  pillar: string | null;
};

async function readLongContent(
  supabase: Supabase,
  contentId: string,
): Promise<LongContent | null> {
  const { data } = await supabase
    .from("contents")
    .select("id, type, title, brand_id, pillar")
    .eq("id", contentId)
    .maybeSingle();
  return data && isLongformType(data.type) ? (data as LongContent) : null;
}

async function readSections(supabase: Supabase, contentId: string) {
  const { data } = await supabase
    .from("content_sections")
    .select("kind, title, body")
    .eq("content_id", contentId)
    .order("position", { ascending: true });
  const rows = (data ?? []) as {
    kind: "section" | "guest" | "transcript";
    title: string | null;
    body: string | null;
  }[];
  return {
    parts: rows.filter((r) => r.kind === "section"),
    guest: rows.find((r) => r.kind === "guest") ?? null,
    transcript: rows.find((r) => r.kind === "transcript")?.body ?? null,
  };
}

/** L'invité et la transcription : une seule ligne de chaque par contenu. */
async function saveSingle(
  supabase: Supabase,
  contentId: string,
  kind: "guest" | "transcript",
  values: { title: string | null; body: string | null },
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("content_sections")
    .select("id")
    .eq("content_id", contentId)
    .eq("kind", kind)
    .maybeSingle();

  const empty = !values.title && !values.body;
  if (!existing && empty) return null;
  const { error } = !existing
    ? await supabase
        .from("content_sections")
        .insert({ content_id: contentId, kind, ...values })
    : empty
      ? await supabase.from("content_sections").delete().eq("id", existing.id)
      : await supabase.from("content_sections").update(values).eq("id", existing.id);
  return error ? error.message : null;
}

/* ------------------------------ Écriture --------------------------------- */

/** Enregistre ce qui a changé, tout ou rien (RPC 0101). */
export async function saveLongform(
  contentId: string,
  input: {
    changed: LongformPart[];
    order: string[];
    deleted: string[];
    guest?: { name: string; bio: string };
  },
) {
  if (input.order.length > MAX_PARTS) {
    return { error: `${MAX_PARTS} parties au maximum.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_content_sections", {
    p_content_id: contentId,
    p_sections: input.changed.map((p) => ({
      id: p.id,
      title: p.title.slice(0, 300),
      body: p.body,
      minutes: p.minutes,
    })),
    p_order: input.order,
    p_deleted: input.deleted,
  });
  if (error) return { error: error.message };

  if (input.guest) {
    const guestError = await saveSingle(supabase, contentId, "guest", {
      title: input.guest.name.trim().slice(0, 300) || null,
      body: input.guest.bio.trim() || null,
    });
    if (guestError) return { error: guestError };
  }

  // Écrire une ligne est un geste : le contenu est en écriture.
  if (input.changed.some((p) => p.title.trim() || p.body.trim())) {
    await applyWritingProgress(supabase, contentId);
  }
  revalidatePath(`/content/${contentId}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** La transcription collée après l'enregistrement. Jamais montrée au client. */
export async function saveTranscript(contentId: string, text: string) {
  const clean = text.trim();
  if (clean.length > MAX_TRANSCRIPT_CHARS) {
    return {
      ok: false as const,
      error: "Cette transcription est trop longue. Colle-la en deux contenus.",
    };
  }
  const supabase = await createClient();
  const error = await saveSingle(supabase, contentId, "transcript", {
    title: null,
    body: clean || null,
  });
  if (error) return { ok: false as const, error };
  return { ok: true as const };
}

/* ---------------------------------- IA ----------------------------------- */

/**
 * Tout ce qu'un appel doit savoir, avec les gardes : le contenu existe, la
 * personne peut y écrire, l'IA est permise sur la marque DE CE CONTENU — et
 * seulement ensuite on paie.
 */
async function prepareAi(
  action: "longform_plan" | "longform_part" | "extracts",
  contentId: string,
  language?: GenerationLanguage,
) {
  const supabase = await createClient();
  const content = await readLongContent(supabase, contentId);
  if (!content) throw new AiError("not_found", "Contenu introuvable.");

  const { data: canWrite } = await supabase.rpc("is_brand_writer", {
    b: content.brand_id,
  });
  if (canWrite !== true) {
    throw new AiError("forbidden", "Tu n'as pas les droits pour écrire sur cette marque.");
  }

  await guardAiAction(action, content.brand_id);
  const [kit, sections] = await Promise.all([
    getBrandKitContext(supabase, contentId),
    readSections(supabase, contentId),
  ]);
  const audience = kit.audiences[0];
  const ctx: LongformContext = {
    type: content.type,
    title: content.title?.trim() || "Sans titre",
    theme: kit.theme,
    objective: kit.objective,
    voice: kit.voice,
    audience: audience ? `${audience.name} — ${audience.who} ${audience.wants}` : undefined,
    guest:
      [sections.guest?.title, sections.guest?.body].filter(Boolean).join(" — ") || undefined,
    language,
  };
  return { supabase, content, ctx, sections };
}

function aiFailure(e: unknown) {
  return {
    ok: false as const,
    error: e instanceof AiError ? e.message : "Erreur inattendue. Réessaie.",
  };
}

/** Propose un plan. N'ENREGISTRE RIEN : l'écran le montre d'abord. */
export async function aiPlanLongform(input: {
  contentId: string;
  topic: string;
  language: GenerationLanguage;
}): Promise<{ ok: true; parts: PlannedPart[] } | { ok: false; error: string }> {
  try {
    if (!input.topic.trim()) return { ok: false, error: "Dis d'abord de quoi ça parle." };
    const { ctx } = await prepareAi("longform_plan", input.contentId, input.language);
    return { ok: true, parts: await planLongform(ctx, input.topic.slice(0, 4000)) };
  } catch (e) {
    return aiFailure(e);
  }
}

/** Écrit UNE partie. Le texte revient dans le formulaire, rien n'est enregistré. */
export async function aiWritePart(input: {
  contentId: string;
  outline: string[];
  index: number;
  previous?: string;
  current?: string;
  language: GenerationLanguage;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    // Refusé, pas tronqué : une réécriture d'un texte coupé en perdrait la fin.
    if (countWords(input.current) > MAX_REWRITE_WORDS) {
      return {
        ok: false,
        error: "Cette partie est trop longue pour être réécrite d'un coup. Découpe-la d'abord.",
      };
    }
    const { ctx } = await prepareAi("longform_part", input.contentId, input.language);
    const text = await writeLongformPart(ctx, {
      outline: input.outline.slice(0, MAX_PARTS),
      index: input.index,
      previous: input.previous,
      current: input.current,
    });
    return { ok: true, text };
  } catch (e) {
    return aiFailure(e);
  }
}

/** D'où sortent les extraits : la transcription, ou le texte écrit à défaut. */
function extractSource(sections: Awaited<ReturnType<typeof readSections>>): string {
  return sections.transcript?.trim() || sectionsToText(sections.parts);
}

export async function aiFindExtracts(input: {
  contentId: string;
}): Promise<
  { ok: true; extracts: ExtractProposal[] } | { ok: false; error: string }
> {
  try {
    const { supabase, content, ctx, sections } = await prepareAi(
      "extracts",
      input.contentId,
    );
    const source = extractSource(sections);
    if (source.length < 300) {
      return {
        ok: false,
        error:
          content.type === "article"
            ? "Écris d'abord l'article : je pars de ton texte."
            : "Colle d'abord la transcription : je pars de ce qui a été dit.",
      };
    }
    const { data: existing } = await supabase
      .from("contents")
      .select("title")
      .eq("source_content_id", input.contentId);

    // La langue de la source décide du modèle (arabe → Gemini).
    const extracts = await findExtracts(
      { ...ctx, language: /[؀-ۿ]/.test(source.slice(0, 2000)) ? "ar_tn" : "fr" },
      source,
      ((existing ?? []) as { title: string | null }[])
        .map((e) => e.title)
        .filter((t): t is string => Boolean(t)),
    );
    return { ok: true, extracts };
  } catch (e) {
    return aiFailure(e);
  }
}

/* ------------------------------- Extraits -------------------------------- */

/**
 * Crée un VRAI contenu à partir d'un contenu long : il a son statut, sa date,
 * sa validation, et vit seul si la source disparaît.
 *
 * Ne fait pas confiance à l'écran : la citation est revérifiée contre la source
 * relue en base, la marque est celle de la source, un double clic ne crée pas
 * deux contenus, et un échec ne laisse pas une fiche à moitié remplie.
 */
export async function createExtract(input: {
  sourceId: string;
  type: string;
  title: string;
  quote?: string;
  hook?: string;
  caption?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const title = input.title.trim().slice(0, 300);
  if (!title) return { ok: false, error: "Donne un titre à cet extrait." };
  if (!isExtractType(input.type)) return { ok: false, error: "Format inconnu." };

  const supabase = await createClient();
  const source = await readLongContent(supabase, input.sourceId);
  if (!source) return { ok: false, error: "Contenu introuvable." };

  const quote = input.quote?.trim();
  if (quote) {
    const sections = await readSections(supabase, input.sourceId);
    if (!quoteIsInSource(quote, extractSource(sections))) {
      return { ok: false, error: "Cette citation n'est plus dans la source. Relance la recherche." };
    }
  }

  // Un double clic, pas deux propositions qui porteraient le même titre.
  const { data: twin } = await supabase
    .from("contents")
    .select("id")
    .eq("source_content_id", input.sourceId)
    .eq("type", input.type)
    .eq("title", title)
    .gte("created_at", new Date(Date.now() - 15_000).toISOString())
    .limit(1);
  if (twin?.[0]) return { ok: true, id: twin[0].id as string };

  const created = await createContentRow({
    type: input.type,
    title,
    brandId: source.brand_id,
    pillar: source.pillar ?? undefined,
    sourceContentId: source.id,
  });
  if ("error" in created) return { ok: false, error: created.error };

  const undo = async (error: string) => {
    await supabase.from("contents").delete().eq("id", created.id);
    return { ok: false as const, error };
  };

  const hook = input.hook?.trim();
  const isReel = input.type === "reel";
  if (isReel && (quote || hook)) {
    const res = await upsertReelDetails(created.id, {
      ...(hook ? { intro: hook } : {}),
      ...(quote ? { script_full: quote } : {}),
    });
    if (res.error) return undo(res.error);
  }
  // Un post et un carrousel n'ont pas de script : l'accroche et le passage
  // vérifié vivent dans la légende, sinon ils disparaîtraient avec l'écran.
  const caption = (
    isReel
      ? [input.caption]
      : [hook, quote && `« ${quote} »`, input.caption]
  )
    .map((t) => t?.trim())
    .filter(Boolean)
    .join("\n\n");
  if (caption) {
    const res = await updateContent(created.id, { caption });
    if (res.error) return undo(res.error);
  }

  revalidatePath(`/content/${input.sourceId}`);
  return { ok: true, id: created.id };
}
