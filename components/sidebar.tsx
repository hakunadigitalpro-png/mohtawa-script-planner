"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  CalendarDays,
  Sparkles,
  LogOut,
  Building2,
  User,
  BarChart3,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSwitcher } from "./brand-switcher";
import { LocaleSwitcherCompact } from "./locale-switcher";
import { NotificationsBell } from "./notifications/notifications-bell";
import type { Notification } from "./notifications/types";
import type { Brand } from "@/lib/types";

type NavItem = {
  href: string;
  /** Clé i18n dans `nav.*` */
  key: "dashboard" | "calendar" | "analytics" | "hooks" | "brands" | "profile";
  icon: LucideIcon;
};

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/analytics", key: "analytics", icon: BarChart3 },
  { href: "/hooks", key: "hooks", icon: BookOpen },
];

const SECONDARY_NAV: NavItem[] = [
  { href: "/brands", key: "brands", icon: Building2 },
  { href: "/profile", key: "profile", icon: User },
];

export function Sidebar({
  brands,
  active,
  userEmail,
  userId,
  initialNotifications,
}: {
  brands: Brand[];
  active: Brand | null;
  userEmail: string | null;
  userId: string;
  initialNotifications: Notification[];
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col items-center gap-3 py-5">
      {/* Logo */}
      <div className="tooltip-trigger flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white shadow-sm">
        <Sparkles className="size-5" />
        <span className="tooltip-content">{t("mohtawa")}</span>
      </div>

      <div className="h-px w-8 bg-border/80" />

      {/* Brand switcher */}
      <BrandSwitcher brands={brands} active={active} />

      <div className="h-px w-8 bg-border/80" />

      {/* Notifications */}
      <NotificationsBell
        userId={userId}
        initialNotifications={initialNotifications}
      />

      {/* Primary nav */}
      <nav className="flex flex-col items-center gap-2">
        {PRIMARY_NAV.map((item) => (
          <NavIcon
            key={item.href}
            href={item.href}
            label={t(item.key)}
            Icon={item.icon}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Locale switcher */}
      <LocaleSwitcherCompact />

      {/* Secondary nav */}
      <nav className="flex flex-col items-center gap-2">
        {SECONDARY_NAV.map((item) => (
          <NavIcon
            key={item.href}
            href={item.href}
            label={t(item.key)}
            Icon={item.icon}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}
      </nav>

      {/* Logout */}
      <form action="/auth/signout" method="post" className="tooltip-trigger">
        <button
          type="submit"
          className="flex size-11 items-center justify-center rounded-full bg-card/80 text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label={userEmail ? `${t("logout")} (${userEmail})` : t("logout")}
        >
          <LogOut className="size-4" />
        </button>
        <span className="tooltip-content">{t("logout")}</span>
      </form>
    </aside>
  );
}

function NavIcon({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "tooltip-trigger flex size-11 items-center justify-center rounded-full transition-all",
        active
          ? "bg-accent text-accent-foreground shadow-sm"
          : "bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground",
      )}
    >
      <Icon className="size-4.5" />
      <span className="tooltip-content">{label}</span>
    </Link>
  );
}
