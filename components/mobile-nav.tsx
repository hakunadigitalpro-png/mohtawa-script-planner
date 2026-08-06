"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  BookOpen,
  Menu,
  Building2,
  User,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSwitcher } from "./brand-switcher";
import { NotificationsBell } from "./notifications/notifications-bell";
import type { Brand } from "@/lib/types";
import type { Notification } from "./notifications/types";
import type { BrandRole } from "@/lib/brand";

/**
 * Navigation mobile (remplace le rail latéral, caché en <md).
 *
 *  - <MobileTopBar>    : barre fine en haut (switcher de marque + cloche notifs)
 *  - <MobileBottomNav> : barre d'onglets en bas (style Instagram/TikTok) +
 *                        bouton "Plus" ouvrant une feuille (marques, profil,
 *                        déconnexion).
 *
 * Sur desktop (md+), ces deux composants sont masqués (`md:hidden`) et c'est
 * le <Sidebar> qui prend le relais.
 */

const PRIMARY_NAV: {
  href: string;
  key: "dashboard" | "calendar" | "analytics" | "hooks";
  icon: LucideIcon;
}[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/analytics", key: "analytics", icon: BarChart3 },
  { href: "/hooks", key: "hooks", icon: BookOpen },
];

export function MobileTopBar({
  brands,
  active,
  userId,
  initialNotifications,
}: {
  brands: Brand[];
  active: Brand | null;
  userId: string;
  initialNotifications: Notification[];
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-card/85 px-3 backdrop-blur md:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <BrandSwitcher brands={brands} active={active} />
        <span className="truncate text-sm font-bold">
          {active?.name ?? "Kreatly"}
        </span>
      </div>
      <NotificationsBell
        userId={userId}
        initialNotifications={initialNotifications}
        channelSuffix="mobile"
      />
    </header>
  );
}

export function MobileBottomNav({
  userEmail,
  role,
}: {
  userEmail: string | null;
  /** Un "viewer" (client invité) est cantonné au Calendrier + son Profil. */
  role: BrandRole | null;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);
  const isClientOnly = role === "viewer";
  const nav = isClientOnly
    ? PRIMARY_NAV.filter((item) => item.key === "calendar")
    : PRIMARY_NAV;

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgba(10,6,18,0.15)] backdrop-blur md:hidden">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors",
                active ? "text-accent" : "text-muted-foreground",
              )}
            >
              <item.icon
                className={cn("size-5", active && "stroke-[2.5px]")}
              />
              <span>{t(item.key)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground"
        >
          <Menu className="size-5" />
          <span>Plus</span>
        </button>
      </nav>

      {menuOpen && (
        <MobileMenuSheet
          userEmail={userEmail}
          labels={{
            brands: t("brands"),
            profile: t("profile"),
            logout: t("logout"),
          }}
          showBrands={!isClientOnly}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}

function MobileMenuSheet({
  userEmail,
  labels,
  showBrands,
  onClose,
}: {
  userEmail: string | null;
  labels: { brands: string; profile: string; logout: string };
  showBrands: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal>
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border/60 bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <nav className="flex flex-col gap-1">
          {showBrands && (
            <Link
              href="/brands"
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-secondary/60"
            >
              <Building2 className="size-5 text-muted" />
              {labels.brands}
            </Link>
          )}
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-secondary/60"
          >
            <User className="size-5 text-muted" />
            {labels.profile}
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="size-5" />
              {labels.logout}
            </button>
          </form>
        </nav>
        {userEmail && (
          <p className="mt-3 truncate px-3 text-xs text-muted">{userEmail}</p>
        )}
      </div>
    </div>
  );
}
