"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function resetPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email requis." };

  const h = await headers();
  const origin = h.get("origin") ?? h.get("x-forwarded-host") ?? "";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin ? `${origin}/login` : undefined,
  });

  if (error) return { error: error.message };
  return { success: "Si un compte existe, un email a été envoyé." };
}
