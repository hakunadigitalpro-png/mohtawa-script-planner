"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./brand/logo";
import { BrandSwitcher } from "./brand-switcher";
import { LocaleSwitcherCompact } from "./locale-switcher";
import { NotificationsBell } from "./notifications/notifications-bell";
import { NAV_COOKIE, type NavMode } from "@/lib/nav-pref";
import { navSectionsFor } from "@/lib/nav";
import type { Notification } from "./notifications/types";
import type { Brand } from "@/lib/types";
import type { BrandRole } from "@/lib/brand";

export function Sidebar({
  brands,
  active,
  userEmail,
  userId,
  initialNotifications,
  role,
  mode,
}: {
  brands: Brand[];
  active: Brand | null;
  userEmail: string | null;
  userId: string;
  initialNotifications: Notification[];
  /** Un "viewer" (client invité) est cantonné au Calendrier + son Profil. */
  role: BrandRole | null;
  /** Large (libellés) ou rail d'icônes — lu en cookie côté serveur. */
  mode: NavMode;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const isClientOnly = role === "viewer";

  // L'état vit ICI, pas sur le serveur : replier, c'est 176 px d'animation,
  // pas une raison de re-rendre toute l'application. Le cookie n'est écrit
  // que pour que le PROCHAIN chargement arrive déjà dans le bon état — c'est
  // le serveur qui le lit, d'où le `mode` reçu en props.
  const [wide, setWide] = useState(isClientOnly || mode === "wide");
  const asideRef = useRef<HTMLElement>(null);

  const sections = navSectionsFor(role);
  // Des titres sur des groupes d'un seul élément seraient pires que pas de
  // titres : le client invité n'a que trois entrées, il les lit d'un coup.
  const showHeadings =
    wide && sections.length > 1 && sections.every((s) => s.items.length > 1);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const toggle = () => {
    const next: NavMode = wide ? "rail" : "wide";
    setWide(!wide);
    document.cookie = `${NAV_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // La largeur du menu, lisible en CSS par les pages qui s'étalent (le
    // calendrier) : posée côté serveur sur le conteneur, mise à jour ici.
    asideRef.current?.parentElement?.style.setProperty(
      "--nav-w",
      next === "wide" ? "16rem" : "6.5rem",
    );
  };

  return (
    <aside
      ref={asideRef}
      className={cn(
        // Pas d'`overflow-hidden` ici : il coupait les infobulles du rail au
        // bord — il n'en restait qu'un croissant noir qui dépassait.
        "sticky top-0 z-30 hidden h-screen shrink-0 flex-col md:flex",
        "transition-[width] duration-200 ease-out",
        // Replié : tout est resserré pour tenir dans 636 px de fenêtre (un
        // portable 1366×768 avec sa barre des tâches). Avant, le rail faisait
        // 830 px — plus haut que le menu large qu'il est censé condenser.
        wide
          ? "w-64 gap-1 border-e border-border/60 px-3 py-4"
          : "w-[6.5rem] items-center gap-2 px-2 py-3",
      )}
    >
      {/* En-tête : l'identité de l'app, puis celle de la marque ouverte. */}
      {wide ? (
        <>
          <div className="flex items-center gap-1 px-1">
            <Link
              href={isClientOnly ? "/calendar" : "/dashboard"}
              className="flex min-w-0 flex-1 items-center gap-2.5"
            >
              <LogoMark
                className="size-10 shrink-0 rounded-xl shadow-sm"
                iconClassName="size-5"
              />
              <span className="truncate text-base font-bold tracking-tight">
                {t("appName")}
              </span>
            </Link>
            <NotificationsBell
              userId={userId}
              initialNotifications={initialNotifications}
              activeBrandId={active?.id ?? null}
            />
            {/* Le client invité n'a que trois entrées : replier ne lui ferait
                rien gagner, et lui donnerait un bouton de plus à comprendre. */}
            {!isClientOnly && (
              <CollapseButton wide onClick={toggle} label={t("collapse")} />
            )}
          </div>
          <div className="mt-2 mb-1">
            <BrandSwitcher
              brands={brands}
              active={active}
              role={role}
              variant="wide"
            />
          </div>
        </>
      ) : (
        <>
          {/* Logo et bouton de repli sur la MÊME ligne : une rangée de moins,
              et c'est elle qui faisait déborder le rail sur un portable. */}
          <div className="flex items-center gap-1">
            <Link
              href={isClientOnly ? "/calendar" : "/dashboard"}
              className="tooltip-trigger"
            >
              <LogoMark
                className="size-10 rounded-xl shadow-sm"
                iconClassName="size-5"
              />
              <span className="tooltip-content">{t("appName")}</span>
            </Link>
            {!isClientOnly && (
              <CollapseButton wide={false} onClick={toggle} label={t("expand")} />
            )}
          </div>
          <BrandSwitcher brands={brands} active={active} role={role} />
          <NotificationsBell
            userId={userId}
            initialNotifications={initialNotifications}
            activeBrandId={active?.id ?? null}
          />
        </>
      )}

      <nav
        className={cn(
          "mt-1 flex min-h-0 flex-col",
          // Replié, les groupes se lisent à l'espacement — sinon huit icônes
          // d'affilée forment une colonne sans articulation.
          wide ? "gap-5 overflow-y-auto" : "w-full items-center gap-2 overflow-y-auto",
        )}
      >
        {sections.map((section) => (
          <div
            key={section.key}
            className={cn("flex flex-col", wide ? "gap-0.5" : "gap-1")}
          >
            {showHeadings && (
              <p className="mb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted">
                {t(`sections.${section.key}`)}
              </p>
            )}
            {section.items.map((item) =>
              wide ? (
                <NavRow
                  key={item.href}
                  href={item.href}
                  label={t(item.key)}
                  Icon={item.icon}
                  active={isActive(item.href)}
                />
              ) : (
                <NavIcon
                  key={item.href}
                  href={item.href}
                  label={t(item.key)}
                  Icon={item.icon}
                  active={isActive(item.href)}
                />
              ),
            )}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      {/* `LocaleSwitcherCompact` dans les deux modes : la version complète
          aligne trois cartes de langue côte à côte — elle est faite pour la
          page Profil, elle déborde d'une colonne de 256 px. */}
      <div
        className={cn(
          "flex",
          wide ? "items-center gap-1" : "flex-col items-center gap-1",
        )}
      >
        <form
          action="/auth/signout"
          method="post"
          className={cn("tooltip-trigger", wide && "min-w-0 flex-1")}
        >
          <button
            type="submit"
            className={cn(
              "flex items-center gap-3 text-muted-foreground transition",
              wide
                ? "w-full rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-destructive/10 hover:text-destructive"
                : "size-10 justify-center rounded-full bg-card/80 hover:bg-destructive/10 hover:text-destructive",
            )}
            aria-label={userEmail ? `${t("logout")} (${userEmail})` : t("logout")}
          >
            <LogOut className="size-4.5 shrink-0" />
            {wide && <span className="truncate">{t("logout")}</span>}
          </button>
          {!wide && <span className="tooltip-content">{t("logout")}</span>}
        </form>
        {/* Pas de langue dans le rail : elle se change sur Mon profil, et
            ces 48 px faisaient déborder le rail sur un portable. */}
        {wide && <LocaleSwitcherCompact />}
      </div>
    </aside>
  );
}

/** Le bouton qui replie ou déplie. Son libellé dit ce qui va se passer. */
function CollapseButton({
  wide,
  onClick,
  label,
}: {
  wide: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = wide ? PanelLeftClose : PanelLeftOpen;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={wide}
      className={cn(
        "tooltip-trigger flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground",
        "size-9",
      )}
    >
      {/* En arabe la barre latérale est à droite : la flèche doit pointer
          dans l'autre sens, sinon elle annonce l'inverse de ce qui arrive. */}
      <Icon className="size-4.5 rtl:-scale-x-100" />
      <span className="tooltip-content">{label}</span>
    </button>
  );
}

/** Une entrée du menu large : icône + libellé, sur toute la largeur. */
function NavRow({
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        active
          // Le libellé reste en couleur de texte : en orange sur ce fond
          // teinté il tombe à 2,6:1 — la ligne où l'on se trouve devenait la
          // moins lisible des huit. Aucun orange de la charte ne passe à
          // cette taille sur ce fond.
          ? "bg-accent/10 font-semibold text-foreground"
          : "font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {/* Le trait dit « vous êtes ici » même pour qui ne distingue pas un
          fond teinté d'un fond uni — et c'est le SEUL orange de la ligne. */}
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-2 start-0 w-1 rounded-full bg-accent"
        />
      )}
      <Icon className="size-4.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/**
 * Une entrée du rail replié : l'icône, et son nom écrit DESSOUS.
 *
 * Plus d'infobulle à deviner au survol : le nom est là, en 12 px (le
 * plancher de la charte), sur deux lignes si besoin. C'est ce que montrait
 * la capture de référence, et c'est pour ça que le rail fait 96 px et non 80.
 */
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
      aria-current={active ? "page" : undefined}
      className="group flex w-full flex-col items-center gap-1 px-1"
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full transition-all",
          // Le rond orange plein pour « tu es ici » est volontaire dans le
          // rail : c'est ce que montre la capture de référence de
          // l'utilisatrice, et c'est le rail d'origine de l'application.
          active
            ? "bg-accent text-accent-foreground shadow-sm"
            : "bg-card/80 text-muted-foreground group-hover:bg-card group-hover:text-foreground",
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <span
        className={cn(
          "line-clamp-2 text-center text-xs leading-tight",
          active
            ? "font-semibold text-foreground"
            : "font-medium text-muted-foreground group-hover:text-foreground",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
