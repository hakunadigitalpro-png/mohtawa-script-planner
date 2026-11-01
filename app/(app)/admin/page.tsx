import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AdminUsersTable, type AdminUser, type AdminPlan } from "@/components/admin/users-table";

/**
 * Écran de pilotage réservé aux admins de la plateforme (Mariam).
 * La RPC `admin_list_users` lève `Forbidden` si l'appelant n'est pas
 * dans `platform_admins` — on en profite pour rediriger vers le dashboard
 * quand ce n'est pas elle. Pas d'entrée dans le menu : adresse directe.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect("/login?next=/admin");

  const [{ data: isAdmin }, { data: users, error }, { data: plans }] =
    await Promise.all([
      supabase.rpc("is_platform_admin"),
      supabase.rpc("admin_list_users"),
      supabase.from("plans").select("id, label, price_tnd, price_eur, max_brands, max_members, max_viewers").order("position", { ascending: true }),
    ]);

  if (!isAdmin || error) redirect("/dashboard");

  const rows = (users ?? []) as AdminUser[];
  const planList = (plans ?? []) as AdminPlan[];

  const days = (iso: string | null) =>
    iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86400_000) : null;
  const stats = {
    total: rows.length,
    active: rows.filter((u) => u.status === "active").length,
    trial: rows.filter((u) => u.status === "trial").length,
    expiring: rows.filter((u) => {
      const d = days(u.ends_at);
      return d !== null && d >= 0 && d <= 7;
    }).length,
    suspended: rows.filter((u) => u.status === "suspended" || u.status === "readonly").length,
    aiMonth: rows.reduce((n, u) => n + (u.ai_calls_month ?? 0), 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin plateforme"
        title="Comptes et abonnements"
        subtitle={
          stats.expiring > 0
            ? `${stats.expiring} compte${stats.expiring > 1 ? "s" : ""} expire${stats.expiring > 1 ? "nt" : ""} dans les 7 jours.`
            : `${stats.total} compte${stats.total > 1 ? "s" : ""} au total.`
        }
      />

      {/* Chiffres clés : un coup d'œil avant de descendre dans la liste. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Comptes" value={stats.total} />
        <Stat label="Actifs" value={stats.active} tone="emerald" />
        <Stat label="En essai" value={stats.trial} tone="amber" />
        <Stat label="Expirent < 7 j" value={stats.expiring} tone={stats.expiring ? "rose" : undefined} />
        <Stat label="Suspendus / lecture" value={stats.suspended} />
        <Stat label="Appels IA ce mois" value={stats.aiMonth} />
      </div>

      <AdminUsersTable users={rows} plans={planList} currentUserId={user.id} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber" | "rose";
}) {
  const ring =
    tone === "emerald"
      ? "border-emerald-200 dark:border-emerald-500/30"
      : tone === "amber"
        ? "border-amber-200 dark:border-amber-500/30"
        : tone === "rose"
          ? "border-rose-200 dark:border-rose-500/30"
          : "border-border/60";
  return (
    <div className={`rounded-2xl border bg-card px-4 py-3 ${ring}`}>
      <div className="text-2xl font-extrabold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
