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

  const renderItem = (item: { href: string; label: string; icon: typeof LayoutDashboard }) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className="size-4" />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Mohtawa</div>
          <div className="text-xs text-muted">Script Planner</div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <BrandSwitcher brands={brands} active={active} />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {PRIMARY_NAV.map(renderItem)}

        <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
          Compte
        </div>
        {SECONDARY_NAV.map(renderItem)}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-2 truncate px-2 text-xs text-muted" title={userEmail ?? ""}>
          {userEmail}
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
            Se déconnecter
          </button>
        </form>
      </div>
    </aside>
  );
}
