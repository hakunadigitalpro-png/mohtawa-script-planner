"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import type { Brand } from "@/lib/types";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/hooks", label: "Accroches", icon: BookOpen },
];

const SECONDARY_NAV = [
  { href: "/brands", label: "Mes marques", icon: Building2 },
  { href: "/profile", label: "Mon profil", icon: User },
];

export function Sidebar({
  brands,
  active,
  userEmail,
}: {
  brands: Brand[];
  active: Brand | null;
  userEmail: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col items-center gap-3 py-5">
      {/* Logo */}
      <div className="tooltip-trigger flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white shadow-sm">
        <Sparkles className="size-5" />
        <span className="tooltip-content">Mohtawa</span>
      </div>

      <div className="h-px w-8 bg-border/80" />

      {/* Brand switcher */}
      <BrandSwitcher brands={brands} active={active} />

      <div className="h-px w-8 bg-border/80" />

      {/* Primary nav */}
      <nav className="flex flex-col items-center gap-2">
        {PRIMARY_NAV.map((item) => (
          <NavIcon
            key={item.href}
            href={item.href}
            label={item.label}
            Icon={item.icon}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Secondary nav */}
      <nav className="flex flex-col items-center gap-2">
        {SECONDARY_NAV.map((item) => (
          <NavIcon
            key={item.href}
            href={item.href}
            label={item.label}
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
          aria-label={userEmail ? `Déconnexion (${userEmail})` : "Déconnexion"}
        >
          <LogOut className="size-4" />
        </button>
        <span className="tooltip-content">Se déconnecter</span>
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
