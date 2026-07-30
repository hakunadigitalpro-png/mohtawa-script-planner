"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { themeAssistantTurn, AiError, type ThemeProposal } from "@/lib/ai";

type Kind = "pillar" | "objective";

function tableFor(kind: Kind) {
  return kind === "pillar" ? "brand_pillars" : "brand_objectives";
}

export async function createTaxonomy(
  kind: Kind,
  brandId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Le nom est requis." };
  if (trimmed.length > 60) return { error: "Nom trop long (60 caractères max)." };

  const supabase = await createClient();

  // Compute next position
  const { data: existing } = await supabase
    .from(tableFor(kind))
    .select("position")
    .eq("brand_id", brandId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from(tableFor(kind))
    .insert({ brand_id: brandId, name: trimmed, position: nextPos })
    .select("id, name")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Ce nom existe déjà." };
    return { error: error.message };
  }

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/", "layout");
  return { ok: true as const, id: data.id, name: data.name };
}

export async function renameTaxonomy(
  kind: Kind,
  id: string,
  name: string,
  brandId: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Le nom est requis." };
  if (trimmed.length > 60) return { error: "Nom trop long (60 caractères max)." };

  const supabase = await createClient();

  // Recover the old name first so we can cascade rename on contents.
  const { data: row } = await supabase
    .from(tableFor(kind))
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const oldName = row?.name;

  const { error } = await supabase
    .from(tableFor(kind))
    .update({ name: trimmed })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Ce nom existe déjà." };
    return { error: error.message };
  }

  // Cascade rename on contents (column matches kind)
  if (oldName && oldName !== trimmed) {
    const col = kind === "pillar" ? "pillar" : "objective";
    await supabase
      .from("contents")
      .update({ [col]: trimmed })
      .eq("brand_id", brandId)
      .eq(col, oldName);
  }

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Met à jour un pilier enrichi : le nom (avec cascade sur contents.pillar,
 * comme renameTaxonomy) ET les détails (objectif, rubriques, exemples, note,
 * part %). Une seule action pour éviter au client d'orchestrer 2 appels.
 */
export async function updatePillar(
  id: string,
  brandId: string,
  patch: {
    name?: string;
    objective?: string | null;
    rubriques?: string[];
    examples?: string[];
    note?: string | null;
    share_pct?: number | null;
  },
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};

  let oldName: string | undefined;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "Le nom est requis." };
    if (trimmed.length > 60) {
      return { error: "Nom trop long (60 caractères max)." };
    }
    const { data: row } = await supabase
      .from("brand_pillars")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    oldName = row?.name;
    update.name = trimmed;
  }
  if (patch.objective !== undefined)
    update.objective = patch.objective?.trim() || null;
  if (patch.note !== undefined) update.note = patch.note?.trim() || null;
  if (patch.rubriques !== undefined)
    update.rubriques = patch.rubriques.map((s) => s.trim()).filter(Boolean);
  if (patch.examples !== undefined)
    update.examples = patch.examples.map((s) => s.trim()).filter(Boolean);
  if (patch.share_pct !== undefined) {
    const n = patch.share_pct;
    update.share_pct =
      n === null || n === undefined || Number.isNaN(n)
        ? null
        : Math.max(0, Math.min(100, Math.round(n)));
  }

  const { error } = await supabase
    .from("brand_pillars")
    .update(update)
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Ce nom existe déjà." };
    return { error: error.message };
  }

  // Cascade rename sur contents.pillar (le nom vit aussi en text sur contents).
  if (oldName && typeof update.name === "string" && oldName !== update.name) {
    await supabase
      .from("contents")
      .update({ pillar: update.name })
      .eq("brand_id", brandId)
      .eq("pillar", oldName);
  }

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/* =========================================================================
   Assistant IA de thèmes de contenu (conversationnel)
   ========================================================================= */

/**
 * Un tour de dialogue avec l'assistant de thèmes. Le client envoie tout
 * l'historique ; on renvoie la réponse de Claude (message + éventuels thèmes).
 * Ne persiste rien — l'application passe par applyBrandThemes.
 */
export async function themeAssistant(input: {
  brandId: string;
  history: { role: "user" | "assistant"; content: string }[];
}) {
  try {
    const supabase = await createClient();
    const { data: brand } = await supabase
      .from("brands")
      .select("name")
      .eq("id", input.brandId)
      .maybeSingle();

    const reply = await themeAssistantTurn({
      brandName: brand?.name ?? "",
      history: input.history,
    });
    return { ok: true as const, reply };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Erreur inattendue. Réessaie." };
  }
}

/**
 * Insère les thèmes validés comme lignes brand_pillars (avec objectif,
 * rubriques, exemples, note, %). N'ajoute que les noms pas déjà présents
 * (dé-doublonnage vs existant ET au sein du lot).
 */
export async function applyBrandThemes(input: {
  brandId: string;
  themes: ThemeProposal[];
}) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("brand_pillars")
    .select("name, position")
    .eq("brand_id", input.brandId);

  const seen = new Set(
    (existing ?? []).map((p) => p.name.trim().toLowerCase()),
  );
  let pos = (existing ?? []).reduce((m, p) => Math.max(m, p.position), 0);

  const rows: {
    brand_id: string;
    name: string;
    position: number;
    objective: string | null;
    rubriques: string[];
    examples: string[];
    note: string | null;
    share_pct: number | null;
  }[] = [];

  for (const t of input.themes ?? []) {
    const name = (t.name ?? "").trim().slice(0, 60);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      brand_id: input.brandId,
      name,
      position: ++pos,
      objective: t.objective?.trim() || null,
      rubriques: (t.rubriques ?? []).map((s) => s.trim()).filter(Boolean),
      examples: (t.examples ?? []).map((s) => s.trim()).filter(Boolean),
      note: t.note?.trim() || null,
      share_pct:
        typeof t.share_pct === "number" && !Number.isNaN(t.share_pct)
          ? Math.max(0, Math.min(100, Math.round(t.share_pct)))
          : null,
    });
  }

  if (rows.length) {
    const { error } = await supabase.from("brand_pillars").insert(rows);
    if (error) return { ok: false as const, error: error.message };
  }

  revalidatePath(`/brands/${input.brandId}`);
  revalidatePath("/", "layout");
  return { ok: true as const, added: rows.length };
}

export async function deleteTaxonomy(
  kind: Kind,
  id: string,
  brandId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(tableFor(kind))
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
