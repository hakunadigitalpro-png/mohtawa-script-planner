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

  const { data, error } = await supabase
    .from("brands")
    .insert({ name, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await setActiveBrandId(data.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
