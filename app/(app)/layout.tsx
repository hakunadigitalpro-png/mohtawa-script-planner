import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { getNavMode } from "@/lib/nav-pref";
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
  // Ce layout est reconstruit à CHAQUE navigation : chaque aller-retour qu'il
  // enchaîne s'ajoute au temps d'attente de toutes les pages. La session, la
  // marque active et les notifications sont indépendantes — elles partent
  // ensemble. (`resolveActiveBrand` est mémorisée par `cache()`, la page qui
  // suit la réutilise sans re-interroger la base.)
  const supabase = await createClient();
  const [user, brandCtx, notificationsRes, navMode] = await Promise.all([
    getCachedUser(),
    resolveActiveBrand(),
    // Tolérant aux échecs : si la RPC n'existe pas encore (migration pas
    // appliquée), on rend 0 notif et la cloche affiche un état vide.
    supabase.rpc("list_my_notifications", { p_limit: 20 }),
    // Lu ici, donc le menu arrive déjà replié ou déplié — pas de saut.
    getNavMode(),
  ]);

  if (!user) redirect("/login");

  const { brands, active, role } = brandCtx;

  // Prénom pour le « Bonjour, … » de Krea : le nom complet du profil, sinon
  // le début de l'email. Jamais l'email entier — on se dit bonjour, on ne
  // s'identifie pas.
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const firstName =
    meta.full_name?.trim().split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    null;

  if (brands.length === 0) {
    return <NoBrandWelcome email={user.email ?? null} />;
  }

  // Chargées plus haut, en même temps que le reste : la cloche s'affiche
  // remplie dès le premier rendu, sans sauter.
  const initialNotifications =
    (notificationsRes.data as Notification[] | null) ?? [];

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
        mode={navMode}
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
      {role !== "viewer" && <KreaCopilot firstName={firstName} />}
    </div>
  );
}
