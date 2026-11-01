"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, generatePassword } from "@/lib/supabase/admin";
import { emailEnabled, renderEmail, sendEmail } from "@/lib/email";

type SubStatus = "trial" | "active" | "readonly" | "suspended";

/** Toutes les actions de cet écran passent par là : platform admin ou rien. */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("is_platform_admin");
  if (!ok) throw new Error("Réservé à l'admin de la plateforme.");
  return supabase;
}

/**
 * Pose ou met à jour l'abonnement d'un utilisateur. La RPC refuse si
 * l'appelant n'est pas platform admin.
 */
export async function adminSetSubscription(input: {
  userId: string;
  planId: string;
  status: SubStatus;
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

/** L'abonnement courant d'un compte, pour les actions qui n'en changent qu'un champ. */
async function currentSub(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan_id, status, ends_at, ai_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  return data as { plan_id: string; status: SubStatus; ends_at: string | null; ai_enabled: boolean } | null;
}

/**
 * Prolonge l'accès (ajoute `days` à `ends_at`, en partant d'aujourd'hui
 * si la date est dépassée pour ne pas prolonger une période morte).
 */
export async function adminExtend(input: { userId: string; days: number }) {
  const supabase = await createClient();
  const cur = await currentSub(supabase, input.userId);
  const base =
    cur?.ends_at && new Date(cur.ends_at) > new Date()
      ? new Date(cur.ends_at)
      : new Date();
  const newEnd = new Date(base.getTime() + input.days * 86400_000);
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_user_id: input.userId,
    p_plan_id: cur?.plan_id ?? "free",
    p_status: "active",
    p_ends_at: newEnd.toISOString(),
    p_ai_enabled: cur?.ai_enabled ?? null,
    p_note: null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Suspendre / réactiver sans toucher au plan, aux dates ni à l'IA. */
export async function adminSetStatus(input: { userId: string; status: SubStatus }) {
  const supabase = await createClient();
  const cur = await currentSub(supabase, input.userId);
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_user_id: input.userId,
    p_plan_id: cur?.plan_id ?? "free",
    p_status: input.status,
    p_ends_at: cur?.ends_at ?? null,
    p_ai_enabled: cur?.ai_enabled ?? null,
    p_note: null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Basculer l'IA seule. */
export async function adminToggleAi(input: { userId: string; enabled: boolean }) {
  const supabase = await createClient();
  const cur = await currentSub(supabase, input.userId);
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_user_id: input.userId,
    p_plan_id: cur?.plan_id ?? "free",
    p_status: cur?.status ?? "trial",
    p_ends_at: cur?.ends_at ?? null,
    p_ai_enabled: input.enabled,
    p_note: null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true as const };
}

/**
 * Crée un compte prêt à l'emploi et le remet à Mariam : e-mail confirmé
 * d'office (pas de mail de vérification à attendre), mot de passe initial
 * généré, abonnement posé, première marque créée si demandée, et — si
 * elle le veut — un e-mail au client avec ses identifiants.
 *
 * Le mot de passe n'est stocké nulle part en clair : il est renvoyé UNE
 * fois à l'écran. S'il est perdu, « Nouveau mot de passe » en régénère un.
 */
export async function adminCreateAccount(input: {
  email: string;
  fullName: string | null;
  planId: string;
  status: SubStatus;
  durationDays: number | null;
  aiEnabled: boolean;
  brandName: string | null;
  sendEmail: boolean;
  note: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Cette adresse e-mail n'a pas l'air complète." };
  }
  let supabase;
  try {
    supabase = await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const password = generatePassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: input.fullName ? { full_name: input.fullName.trim() } : undefined,
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Création impossible.";
    return {
      error: /already|exists|registered/i.test(msg)
        ? "Un compte existe déjà avec cette adresse."
        : msg,
    };
  }
  const userId = created.user.id;

  // Abonnement — via la RPC (contrôle admin côté base), comme le dialog Modifier.
  const endsAt =
    input.durationDays && input.durationDays > 0
      ? new Date(Date.now() + input.durationDays * 86400_000).toISOString()
      : null;
  const { error: subErr } = await supabase.rpc("admin_set_subscription", {
    p_user_id: userId,
    p_plan_id: input.planId,
    p_status: input.status,
    p_ends_at: endsAt,
    p_ai_enabled: input.aiEnabled,
    p_note: input.note ?? null,
  });
  if (subErr) return { error: `Compte créé, mais abonnement non posé : ${subErr.message}` };

  // Première marque, dont le nouveau compte est owner. Le trigger
  // brands_add_owner (0001) crée la ligne brand_members à partir de
  // created_by — qu'on pose explicitement puisqu'ici auth.uid() est nul.
  let brandId: string | null = null;
  if (input.brandName?.trim()) {
    const { data: b, error: bErr } = await admin
      .from("brands")
      .insert({ name: input.brandName.trim(), created_by: userId })
      .select("id")
      .single();
    if (bErr) return { error: `Compte créé, mais marque non créée : ${bErr.message}`, userId, password };
    brandId = b.id as string;
  }

  // E-mail d'accueil avec les identifiants. Jamais bloquant.
  let emailed = false;
  if (input.sendEmail && emailEnabled()) {
    const html = renderEmail({
      title: "Ton accès à Kreatly est prêt",
      intro: `${input.fullName ? `Bonjour ${input.fullName.trim()}, ` : ""}Mariam t'a ouvert un compte sur Kreatly. Voici tes identifiants — tu pourras changer le mot de passe depuis ton profil.`,
      card: brandId
        ? { title: input.brandName!.trim(), meta: "Ta marque est déjà créée, tu y es propriétaire." }
        : undefined,
      quote: `Identifiant : ${email}\nMot de passe : ${password}`,
      ctaLabel: "Me connecter",
      ctaPath: "/login",
      footer: "Tu reçois cet e-mail parce que Mariam Ben Aissa t'a créé un accès Kreatly.",
    });
    emailed =
      (await sendEmail({ to: [email], subject: "Ton accès à Kreatly", html })) > 0;
  }

  revalidatePath("/admin");
  return { ok: true as const, userId, email, password, brandId, emailed };
}

/** Régénère un mot de passe et le renvoie une fois à l'écran. */
export async function adminResetPassword(input: { userId: string }) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(input.userId, { password });
  if (error) return { error: error.message };
  return { ok: true as const, password };
}
