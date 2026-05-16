"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
