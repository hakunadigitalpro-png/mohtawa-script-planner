"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Pose ou met à jour l'abonnement d'un utilisateur. La RPC refuse si
 * l'appelant n'est pas platform admin.
 */
export async function adminSetSubscription(input: {
  userId: string;
  planId: string;
  status: "trial" | "active" | "readonly" | "suspended";
  /** Durée à ajouter en jours. 0 ou null = pas de date de fin. */
  durationDays: number | null;
  aiEnabled: boolean | null;
  note?: string | null;
}) {
  const supabase = await createClient();
  const endsAt =
    input.durationDays && input.durationDays > 0
      ? new Date(Date.now() + input.durationDays * 86400_000).toISOString()
      : null;
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_user_id: input.userId,
    p_plan_id: input.planId,
    p_status: input.status,
    p_ends_at: endsAt,
    p_ai_enabled: input.aiEnabled,
    p_note: input.note ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true as const };
}

/**
 * Prolonge l'accès (ajoute `days` à `ends_at`, en partant d'aujourd'hui
 * si la date est dépassée pour ne pas prolonger une période morte).
 */
export async function adminExtend(input: {
  userId: string;
  days: number;
}) {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("subscriptions")
    .select("plan_id, status, ends_at, ai_enabled")
    .eq("user_id", input.userId)
    .maybeSingle();
  const base =
    current?.ends_at && new Date(current.ends_at) > new Date()
      ? new Date(current.ends_at)
      : new Date();
  const newEnd = new Date(base.getTime() + input.days * 86400_000);
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_user_id: input.userId,
    p_plan_id: current?.plan_id ?? "free",
    p_status: "active",
    p_ends_at: newEnd.toISOString(),
    p_ai_enabled: current?.ai_enabled ?? null,
    p_note: null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true as const };
}
