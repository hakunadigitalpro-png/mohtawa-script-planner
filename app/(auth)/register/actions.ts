"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  return value;
}

export async function register(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password || password.length < 6) {
    return { error: "Mot de passe trop court (6 caractères minimum)." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) return { error: error.message };

  // Si email confirmations désactivées : on a déjà la session → on file à `next`.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  return {
    success:
      "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.",
  };
}
