import { createClient } from "@/lib/supabase/server";

/**
 * Un abonnement, vu depuis l'app. Toujours chargé via `getMyPlan()` qui
 * crée automatiquement une row « free/trial 14 jours » pour un nouvel
 * utilisateur — on n'a jamais à vérifier le NULL côté appelant.
 */
export type MyPlan = {
  plan_id: "free" | "solo" | "agence" | "studio";
  plan_label: string;
  status: "trial" | "active" | "readonly" | "suspended";
  started_at: string;
  ends_at: string | null;
  ai_enabled: boolean;
  max_brands: number | null;
  max_members: number | null;
  max_viewers: number | null;
};

/**
 * Le plan effectif de l'utilisateur courant. Appelle la RPC
 * `get_my_plan` qui calcule le statut d'après `ends_at` et crée l'abo
 * « free » si l'utilisateur n'en a pas encore.
 */
export async function getMyPlan(): Promise<MyPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_plan");
  if (error) return null;
  return (data as MyPlan | null) ?? null;
}

/** Jours restants avant la fin d'accès ; null si pas de date. */
export function daysRemaining(plan: MyPlan): number | null {
  if (!plan.ends_at) return null;
  return Math.round(
    (new Date(plan.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

/** L'accès complet (écriture + IA + invitation + création de marque) est-il
 *  encore ouvert ? Vrai pour `trial` et `active`, faux dès `readonly`. */
export function canWrite(plan: MyPlan): boolean {
  return plan.status === "trial" || plan.status === "active";
}

/** Garde à mettre dans les actions qui créent une marque. Renvoie une
 *  chaîne d'erreur à afficher si l'accès est refusé, `null` si OK. */
export async function assertCanAddBrand(): Promise<string | null> {
  const plan = await getMyPlan();
  if (!plan) return "Impossible de lire ton plan.";
  if (!canWrite(plan)) return planBlockedMessage(plan);
  if (plan.max_brands === null) return null;
  const supabase = await createClient();
  const { count } = await supabase
    .from("brand_members")
    .select("*", { count: "exact", head: true })
    .eq("role", "owner");
  if ((count ?? 0) >= plan.max_brands) {
    return `Ton plan ${plan.plan_label} inclut ${plan.max_brands} marque${plan.max_brands > 1 ? "s" : ""}. Contacte Mariam pour passer au plan supérieur.`;
  }
  return null;
}

/** Garde à mettre dans l'invitation. */
export async function assertCanInviteMember(
  brandId: string,
  role: "owner" | "admin" | "editor" | "viewer",
): Promise<string | null> {
  const plan = await getMyPlan();
  if (!plan) return "Impossible de lire ton plan.";
  if (!canWrite(plan)) return planBlockedMessage(plan);
  const supabase = await createClient();
  if (role === "viewer") {
    if (plan.max_viewers === null) return null;
    const { data } = await supabase.rpc("list_brand_members_with_emails", {
      p_brand_id: brandId,
    });
    const viewers = ((data ?? []) as { role: string }[]).filter(
      (m) => m.role === "viewer",
    ).length;
    if (viewers >= plan.max_viewers) {
      return `Ton plan ${plan.plan_label} limite à ${plan.max_viewers} client${plan.max_viewers > 1 ? "s" : ""} invité${plan.max_viewers > 1 ? "s" : ""} par marque.`;
    }
  } else {
    if (plan.max_members === null) return null;
    const { data } = await supabase.rpc("list_brand_members_with_emails", {
      p_brand_id: brandId,
    });
    const members = ((data ?? []) as { role: string }[]).filter(
      (m) => m.role !== "viewer",
    ).length;
    if (members >= plan.max_members) {
      return `Ton plan ${plan.plan_label} limite à ${plan.max_members} membre${plan.max_members > 1 ? "s" : ""} par marque.`;
    }
  }
  return null;
}

/** Garde à mettre devant les actions IA. */
export async function assertCanUseAi(): Promise<string | null> {
  const plan = await getMyPlan();
  if (!plan) return "Impossible de lire ton plan.";
  if (!canWrite(plan)) return planBlockedMessage(plan);
  if (!plan.ai_enabled) {
    return "L'IA n'est pas incluse dans ton plan. Contacte Mariam pour l'activer.";
  }
  return null;
}

function planBlockedMessage(plan: MyPlan): string {
  if (plan.status === "readonly") {
    return "Ton accès est en lecture seule. Contacte Mariam pour prolonger.";
  }
  if (plan.status === "suspended") {
    return "Ton compte est suspendu. Contacte Mariam.";
  }
  return "Accès refusé.";
}
