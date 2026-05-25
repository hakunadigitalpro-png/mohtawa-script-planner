"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "./types";

/**
 * Cloche de notifications dans la sidebar :
 *  - Badge orange avec le nombre de non-lues
 *  - Click → popover avec la liste des N dernières notifs
 *  - Click sur une notif → navigate vers /content/[id] + marque la notif comme lue
 *  - Realtime : nouvelle notif → ajoutée en tête de liste + badge incrémenté
 *  - Bouton "Tout marquer lu"
 */
export function NotificationsBell({
  userId,
  initialNotifications,
}: {
  userId: string;
  initialNotifications: Notification[];
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<Notification[]>(
    initialNotifications,
  );
  const [open, setOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  // -------- Realtime : nouvelle notif OU notif marquée lue --------
  // On ne peut pas reconstruire la row enrichie (titre vidéo + guest_name etc.)
  // depuis l'event Realtime brut, donc on rappelle la RPC pour la fraîcheur.
  //
  // On écoute UPDATE aussi parce que mark_content_read (depuis migration 0014)
  // flippe les notifs read=true côté serveur quand le user ouvre le drawer
  // commentaires sur la page /content/[id] — il faut que la cloche le voie.
  React.useEffect(() => {
    const refreshList = async () => {
      const { data } = await supabase.rpc("list_my_notifications", {
        p_limit: 20,
      });
      if (data) setNotifications(data as Notification[]);
    };

    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshList();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshList();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // -------- Click outside : ferme le popover --------
  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // -------- Click sur une notif --------
  const handleClick = React.useCallback(
    async (notif: Notification) => {
      // Optimistic : on marque lue localement
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
      );
      // Persist côté DB (fire-and-forget — pas grave si ça échoue)
      void supabase.rpc("mark_notification_read", {
        p_notification_id: notif.id,
      });
      setOpen(false);
      if (notif.content_id) {
        router.push(`/content/${notif.content_id}`);
      }
    },
    [router, supabase],
  );

  // -------- Tout marquer comme lu --------
  const handleMarkAllRead = React.useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void supabase.rpc("mark_all_notifications_read");
  }, [supabase]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("ariaLabel")}
        className={cn(
          "tooltip-trigger relative flex size-11 items-center justify-center rounded-full transition-all",
          open
            ? "bg-card text-foreground"
            : "bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground",
        )}
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        <span className="tooltip-content">{t("tooltip")}</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-full top-0 z-50 ml-3 w-80 origin-top-left rounded-2xl border border-border/60 bg-card p-2 shadow-xl"
          style={{ maxHeight: "70vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2">
            <h3 className="text-sm font-semibold">{t("title")}</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                <Check className="size-3" />
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="h-px bg-border/60" />

          {/* Liste */}
          <div className="overflow-y-auto py-1" style={{ maxHeight: "60vh" }}>
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </div>
            ) : (
              <ul className="flex flex-col">
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onClick={() => handleClick(n)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const t = useTranslations("notifications");
  const tTime = useTranslations("comments.time");
  const targetLabelKey = targetLabelKeyFor(notification.comment_target_type);
  const author = notification.is_guest
    ? `${notification.guest_name?.trim() || t("guestBadge")} (${t("guestBadge")})`
    : notification.author_email?.split("@")[0] ?? "anon";

  // Preview du body : on coupe à 80 caractères
  const body = notification.comment_body ?? "";
  const bodyPreview = body.length > 80 ? body.slice(0, 80) + "…" : body;

  // Temps relatif via les clés i18n `comments.time.*` (déjà câblées en FR/EN/AR)
  const relative = formatRelative(notification.created_at, tTime);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left transition",
          notification.read
            ? "hover:bg-background/60"
            : "bg-accent/5 hover:bg-accent/10",
        )}
      >
        <div className="flex w-full items-start gap-2">
          {!notification.read && (
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {notification.content_title || t("untitled")}
              {targetLabelKey && (
                <>
                  {" · "}
                  <span className="font-medium text-foreground/70">
                    {t(targetLabelKey)}
                  </span>
                </>
              )}
            </p>
            <p className="mt-0.5 text-sm">
              <span className="font-medium">{author}</span>{" "}
              <span className="text-muted-foreground">{bodyPreview}</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {relative}
            </p>
          </div>
        </div>
      </button>
    </li>
  );
}

/**
 * Renvoie une clé i18n pour le type de bloc commenté.
 * Pour 'plan' / 'script' on a une simple traduction. Pour 'scene' / 'slide'
 * on ne peut pas inclure le numéro (le storyboard est chargé seulement sur
 * la page détail) — on affiche juste "Scène" / "Slide".
 */
function targetLabelKeyFor(
  type: "plan" | "script" | "scene" | "slide" | null,
): "targetPlan" | "targetScript" | "targetScene" | "targetSlide" | null {
  if (!type) return null;
  switch (type) {
    case "plan":
      return "targetPlan";
    case "script":
      return "targetScript";
    case "scene":
      return "targetScene";
    case "slide":
      return "targetSlide";
  }
}

/**
 * Format relatif via les clés i18n existantes `comments.time.*`.
 * Pas besoin d'une lib pour ça.
 */
function formatRelative(
  iso: string,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSec < 60) return t("justNow");
  if (diffSec < 3600) return t("minutes", { count: Math.floor(diffSec / 60) });
  if (diffSec < 86400) return t("hours", { count: Math.floor(diffSec / 3600) });
  return t("days", { count: Math.floor(diffSec / 86400) });
}
