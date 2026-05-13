"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setActiveBrandId } from "@/lib/brand";

export async function switchBrand(brandId: string) {
  await setActiveBrandId(brandId);
  revalidatePath("/", "layout");
}

export async function createBrand(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Le nom est requis." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  // created_by est rempli par le trigger BEFORE INSERT (migration 0002).
  const { data, error } = await supabase
    .from("brands")
    .insert({ name })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await setActiveBrandId(data.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
