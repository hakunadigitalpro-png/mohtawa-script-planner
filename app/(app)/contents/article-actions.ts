"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AiError } from "@/lib/ai";
import { guardAiAction } from "@/lib/ai-guard";
import { writeArticle } from "@/lib/ai-longform";
import {
  briefSummary,
  claimsMissing,
  cleanBrief,
  cleanDraft,
  cleanSheet,
  draftParts,
  mergeSheet,
  prefillBrief,
  type ArticleBrief,
  type ArticleDraft,
  type AuthorSheet,
} from "@/lib/article";
import { getBrandKitContext } from "@/lib/brand-kit-context";
import { applyWritingProgress } from "@/lib/content-lifecycle-db";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Fail = { ok: false; error: string };

/** Les versions de Krea qu'on garde : la dernière, et celle d'avant. */
const MAX_DRAFTS = 2;

async function readArticle(supabase: Supabase, contentId: string) {
  const { data } = await supabase
    .from("contents")
    .select("id, type, title, notes, brand_id")
    .eq("id", contentId)
    .maybeSingle();
  if (!data || data.type !== "article") return null;
  const { data: canWrite } = await supabase.rpc("is_brand_writer", { b: data.brand_id });
  return canWrite === true
    ? (data as { id: string; title: string | null; notes: string | null; brand_id: string })
    : null;
}

const NO_ACCESS: Fail = { ok: false, error: "Cet article ne t'est pas accessible." };

function readDrafts(raw: unknown): ArticleDraft[] {
  return (Array.isArray(raw) ? raw : [])
    .map(cleanDraft)
    .filter((d): d is ArticleDraft => d !== null)
    .slice(0, MAX_DRAFTS);
}

/** Tout ce que la fenêtre d'écriture doit savoir à l'ouverture. */
export async function loadArticleWriter(contentId: string): Promise<
  | {
      ok: true;
      brief: ArticleBrief;
      /** La fiche auteur telle qu'enregistrée, pour dire ce qui en vient. */
      sheet: AuthorSheet;
      topic: string;
      drafts: ArticleDraft[];
      /** Le brief de cet article a déjà été rempli. */
      briefSaved: boolean;
    }
  | Fail
> {
  const supabase = await createClient();
  const article = await readArticle(supabase, contentId);
  if (!article) return NO_ACCESS;

  const [briefRes, kitRes, strategyRes] = await Promise.all([
    supabase
      .from("article_briefs")
      .select("brief, drafts")
      .eq("content_id", contentId)
      .maybeSingle(),
    supabase
      .from("brand_kits")
      .select("author_sheet")
      .eq("brand_id", article.brand_id)
      .maybeSingle(),
    supabase
      .from("brand_strategies")
      .select("answers, generated")
      .eq("brand_id", article.brand_id)
      .maybeSingle(),
  ]);
  const generated = strategyRes.data?.generated as {
    audiences?: { name: string; who: string; wants: string }[];
  } | null;
  return {
    ok: true,
    brief: prefillBrief({
      saved: briefRes.data?.brief,
      sheet: kitRes.data?.author_sheet,
      answers: (strategyRes.data?.answers ?? null) as Record<string, string> | null,
      audience: generated?.audiences?.[0] ?? null,
    }),
    sheet: cleanSheet(kitRes.data?.author_sheet),
    topic: article.notes?.trim() || article.title?.trim() || "",
    drafts: readDrafts(briefRes.data?.drafts),
    briefSaved: Boolean(briefRes.data?.brief),
  };
}

/** La fiche auteur d'une marque : ce qui ne change pas d'un article à l'autre. */
export async function saveAuthorSheet(
  brandId: string,
  raw: AuthorSheet,
): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { error } = await supabase.from("brand_kits").upsert({
    brand_id: brandId,
    author_sheet: cleanSheet(raw),
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/brands/${brandId}`);
  return { ok: true };
}

/**
 * Écrit l'article entier sur son brief. Le brief est enregistré AVANT l'appel et
 * la version reçue APRÈS, côté serveur : un onglet fermé pendant l'attente ne
 * fait perdre ni l'un ni l'autre. Rien n'est appliqué à la fiche.
 */
export async function aiWriteArticle(input: {
  contentId: string;
  topic: string;
  brief: ArticleBrief;
  /** Garder pour les prochains articles ce qui diffère de la fiche auteur. */
  keepSheetChanges: boolean;
}): Promise<{ ok: true; drafts: ArticleDraft[]; summary: string } | Fail> {
  try {
    const topic = input.topic.trim().slice(0, 4000);
    if (!topic) return { ok: false, error: "Dis d'abord de quoi parle l'article." };
    const supabase = await createClient();
    const article = await readArticle(supabase, input.contentId);
    if (!article) return NO_ACCESS;
    const brief = cleanBrief(input.brief);

    const { data: kit } = await supabase
      .from("brand_kits")
      .select("author_sheet")
      .eq("brand_id", article.brand_id)
      .maybeSingle();
    const before = cleanSheet(kit?.author_sheet);
    const sheet = mergeSheet(before, brief, input.keepSheetChanges);
    const { error: briefError } = await supabase
      .from("article_briefs")
      .upsert({ content_id: article.id, brief });
    if (briefError) return { ok: false, error: briefError.message };
    if (JSON.stringify(sheet) !== JSON.stringify(before)) {
      await saveAuthorSheet(article.brand_id, sheet);
    }

    await guardAiAction("article_full", article.brand_id);
    const kitCtx = await getBrandKitContext(supabase, article.id);
    const draft = await writeArticle(
      {
        type: "article",
        title: article.title?.trim() || "Sans titre",
        theme: kitCtx.theme,
        objective: kitCtx.objective,
        voice: kitCtx.voice,
        language: brief.language,
      },
      brief,
      topic,
    );

    // Relues APRÈS l'appel : une autre version a pu arriver pendant l'attente. Un
    // échec d'enregistrement n'empêche pas de montrer ce qui vient d'être écrit.
    const { data: latest } = await supabase
      .from("article_briefs")
      .select("drafts")
      .eq("content_id", article.id)
      .maybeSingle();
    const drafts = [draft, ...readDrafts(latest?.drafts)].slice(0, MAX_DRAFTS);
    await supabase.from("article_briefs").update({ drafts }).eq("content_id", article.id);
    return { ok: true, drafts, summary: briefSummary(brief) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof AiError ? e.message : "Erreur inattendue. Réessaie.",
    };
  }
}

/**
 * Remplace l'article de la fiche par une version de Krea, d'un coup : titre,
 * sous-titre, parties, texte de partage, idée d'image, points à valider. La
 * version d'avant est gardée (RPC 0104).
 *
 * Reçoit l'article LU, pas son rang : une autre version arrivée entre-temps
 * décalerait les rangs, et on appliquerait un texte que personne n'a lu.
 */
export async function applyArticleDraft(input: {
  contentId: string;
  draft: ArticleDraft;
  title: string;
}): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const article = await readArticle(supabase, input.contentId);
  if (!article) return NO_ACCESS;
  const draft = cleanDraft(input.draft);
  if (!draft) return { ok: false, error: "Cet article est vide. Relance l'écriture." };

  const title = input.title.trim().slice(0, 300) || draft.titles[0] || article.title || "";
  const { error } = await supabase.rpc("write_article", {
    p_content_id: article.id,
    p_article: {
      title,
      subtitle: draft.subtitle,
      caption: draft.share,
      cover_brief: draft.coverBrief,
      parts: draftParts(draft, title),
      // Coupé avant la liste : garder celle qui est en place.
      claims: claimsMissing(draft) ? null : draft.claims.map((t) => ({ text: t })),
    },
    p_exact: false,
  });
  if (error) return { ok: false, error: error.message };
  await applyWritingProgress(supabase, article.id);
  revalidatePath(`/content/${article.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Revient à une version gardée ; l'actuelle prend sa place dans la liste. */
export async function restoreArticle(
  contentId: string,
  at: string,
): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_article", {
    p_content_id: contentId,
    p_at: at,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("nothing_to_restore")
        ? "Cette version n'est plus là. Recharge la page."
        : error.message,
    };
  }
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

/** L'idée d'image, enregistrée avec le texte de partage (un seul bouton). */
export async function saveCoverBrief(contentId: string, text: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("article_briefs")
    .upsert({ content_id: contentId, cover_brief: text.trim().slice(0, 4000) || null });
  if (error) return { error: error.message };
  return { ok: true as const };
}

/* ---------------------- À valider par l'auteur --------------------------- */

export async function addClaim(
  contentId: string,
  text: string,
): Promise<{ ok: true } | Fail> {
  const clean = text.trim().slice(0, 600);
  if (!clean) return { ok: false, error: "Écris d'abord le point à valider." };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("article_claims")
    .select("position")
    .eq("content_id", contentId)
    .order("position", { ascending: false })
    .limit(1);
  const { error } = await supabase.from("article_claims").insert({
    content_id: contentId,
    text: clean,
    position: ((last?.[0]?.position as number | undefined) ?? -1) + 1,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

/** Coché par l'équipe ; qui et quand sont posés par la base (0104). */
export async function setClaimChecked(
  contentId: string,
  claimId: string,
  checked: boolean,
): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("article_claims")
    .update({ checked_at: checked ? new Date().toISOString() : null })
    .eq("id", claimId)
    .eq("content_id", contentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}

export async function removeClaim(
  contentId: string,
  claimId: string,
): Promise<{ ok: true } | Fail> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("article_claims")
    .delete()
    .eq("id", claimId)
    .eq("content_id", contentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}
