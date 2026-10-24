import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AdminUsersTable } from "@/components/admin/users-table";

/**
 * Écran de pilotage réservé aux admins de la plateforme (Mariam).
 * La RPC `admin_list_users` lève `Forbidden` si l'appelant n'est pas
 * dans `platform_admins` — on en profite pour ignorer la liste et
 * rediriger vers le dashboard quand ce n'est pas elle.
 */
type AdminUser = {
  user_id: string;
  email: string;
  created_at: string;
  plan_id: string | null;
  status: string | null;
  ends_at: string | null;
  ai_enabled: boolean | null;
  brand_count: number;
  ai_calls_today: number;
  ai_calls_month: number;
};

type Plan = {
  id: string;
  label: string;
  price_tnd: number | null;
  price_eur: number | null;
  max_brands: number | null;
  max_members: number | null;
  max_viewers: number | null;
};

export default async function AdminPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect("/login?next=/admin");

  const [{ data: isAdmin }, { data: users, error }, { data: plans }] =
    await Promise.all([
      supabase.rpc("is_platform_admin"),
      supabase.rpc("admin_list_users"),
      supabase.from("plans").select("*").order("position", { ascending: true }),
    ]);

  if (!isAdmin || error) redirect("/dashboard");

  const rows = (users ?? []) as AdminUser[];
  const planList = (plans ?? []) as Plan[];

  // Compteur « expire dans 7 jours » pour attirer l'œil.
  const soon = rows.filter((u) => {
    if (!u.ends_at) return false;
    const d = Math.round(
      (new Date(u.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return d >= 0 && d <= 7;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin plateforme"
        title="Comptes et abonnements"
        subtitle={
          soon > 0
            ? `${soon} compte${soon > 1 ? "s" : ""} expire${soon > 1 ? "nt" : ""} dans les 7 jours.`
            : `${rows.length} compte${rows.length > 1 ? "s" : ""} au total.`
        }
      />
      <AdminUsersTable users={rows} plans={planList} />
    </div>
  );
}
