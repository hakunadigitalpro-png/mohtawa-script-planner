import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { Sidebar } from "@/components/sidebar";
import { NoBrandWelcome } from "@/components/no-brand";
import type { Notification } from "@/components/notifications/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { brands, active } = await resolveActiveBrand();

  if (brands.length === 0) {
    return <NoBrandWelcome email={user.email ?? null} />;
  }

  // Fetch initial notifications côté serveur pour éviter le flash sur la cloche.
  // Tolérant aux échecs : si la RPC n'existe pas encore (migration pas appliquée),
  // on rend juste 0 notifs et le bell affiche un état vide.
  const { data: notificationsData } = await supabase.rpc(
    "list_my_notifications",
    { p_limit: 20 },
  );
  const initialNotifications = (notificationsData as Notification[] | null) ?? [];

  return (
    <div className="flex min-h-screen">
      <Sidebar
        brands={brands}
        active={active}
        userEmail={user.email ?? null}
        userId={user.id}
        initialNotifications={initialNotifications}
      />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
