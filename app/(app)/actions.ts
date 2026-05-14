"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setActiveBrandId } from "@/lib/brand";

export async function switchBrand(brandId: string) {
  await setActiveBrandId(brandId);
  revalidatePath("/", "layout");
}

export async function renameBrand(brandId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Le nom est requis." };
  if (trimmed.length > 80) return { error: "Nom trop long (80 caractères max)." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("brands")
    .update({ name: trimmed })
    .eq("id", brandId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBrand(brandId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").delete().eq("id", brandId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProfile(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const language = String(formData.get("language") ?? "fr");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: fullName, language },
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createBrand(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Le nom est requis." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  // RPC security definer (migration 0003) - contourne les soucis RLS.
  const { data: brandId, error } = await supabase.rpc("create_brand", {
    p_name: name,
  });

  if (error) {
    if (error.message.includes("not_authenticated")) {
      return { error: "Session expirée. Reconnecte-toi." };
    }
    if (error.message.includes("name_required")) {
      return { error: "Le nom est requis." };
    }
    if (error.message.includes("name_too_long")) {
      return { error: "Nom trop long (80 caractères max)." };
    }
    return { error: error.message };
  }

  await setActiveBrandId(brandId as string);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
