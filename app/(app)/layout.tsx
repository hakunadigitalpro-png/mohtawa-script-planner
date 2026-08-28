import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { Sidebar } from "@/components/sidebar";
import { MobileTopBar, MobileBottomNav } from "@/components/mobile-nav";
import { NoBrandWelcome } from "@/components/no-brand";
import { KreaCopilot } from "@/components/krea/krea-copilot";
import type { Notification } from "@/components/notifications/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { brands, active, role } = await resolveActiveBrand();

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
      {/* Rail latéral : desktop uniquement (caché en <md via la classe interne). */}
      <Sidebar
        brands={brands}
        active={active}
        userEmail={user.email ?? null}
        userId={user.id}
        initialNotifications={initialNotifications}
        role={role}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Barre du haut : mobile uniquement (md:hidden). */}
        <MobileTopBar
          brands={brands}
          active={active}
          userId={user.id}
          initialNotifications={initialNotifications}
        />
        <main className="flex-1 overflow-x-hidden">
          {/* pb-24 sur mobile = espace pour la barre du bas fixe ; px-4 gagne
              de la largeur. Dès md (rail + pas de barre du bas) → pb-10. */}
          <div className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:px-6 sm:pt-10 md:pb-10">
            {children}
          </div>
        </main>
      </div>
      {/* Barre d'onglets du bas : mobile uniquement (md:hidden). */}
      <MobileBottomNav userEmail={user.email ?? null} role={role} />
      {/* Krea vit dans le layout : son fil de discussion survit donc aux
          changements de page (navigation douce = le layout ne remonte pas).
          Pas pour un "viewer" (client invité) : il n'a rien à configurer. */}
      {role !== "viewer" && <KreaCopilot />}
    </div>
  );
}
