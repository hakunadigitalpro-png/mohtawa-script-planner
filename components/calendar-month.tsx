"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  Music2,
  type LucideIcon,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { fr, ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ColorDot } from "@/components/ui/badge";
import { typeColor, statusColor, statusLabel } from "@/lib/constants";
import { NewContentModal } from "@/components/new-content-modal";
import { ContentCommentsButton } from "@/components/comments";
import { updateContent, updatePublication } from "@/app/(app)/contents/actions";

const DRAG_MIME = "application/x-mohtawa-calendar-entry";

/**
 * Une carte du calendrier = une (contenu × plateforme), pas un contenu. Un
 * même contenu programmé sur Instagram le 4 ET Facebook le 6 apparaît donc
 * deux fois, chacune sur sa propre date avec l'icône de SA plateforme.
 * `publicationId` est null pour les contenus datés sans plateforme choisie
 * (ou cas legacy sans publication associée) — affichés sans icône, comme
 * avant cette refonte.
 */
export type CalendarEntry = {
  key: string;
  contentId: string;
  publicationId: string | null;
  platform: string | null;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string | null; // HH:MM:SS
  title: string | null;
  type: string;
  pillar: string | null;
  status: string;
};

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  linkedin: Linkedin,
  // Pas d'icône TikTok dans lucide-react — la note de musique est le
  // meilleur équivalent disponible dans le set.
  tiktok: Music2,
};

function formatTimeFr(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  if (!h || !m) return null;
  return `${h}h${m}`;
}

export function CalendarMonth({
  initialMonth,
  entries,
  commentCounts = {},
}: {
  initialMonth: string; // YYYY-MM-01
  entries: CalendarEntry[];
  /** contentId → nombre de commentaires non lus (badge). */
  commentCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations("calendar");
  const tContent = useTranslations("content");
  const locale = useLocale();
  const dateLocale = locale === "ar" ? ar : fr;
  const cursor = useMemo(() => parseISO(initialMonth), [initialMonth]);

  const [modalOpen, setModalOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | undefined>(undefined);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const goto = (newDate: Date) => {
    const params = new URLSearchParams(sp.toString());
    params.set("m", format(newDate, "yyyy-MM"));
    router.push(`/calendar?${params.toString()}`);
  };

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const key = e.scheduledDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    // Dans une même journée, les entrées avec heure passent avant, triées ;
    // celles sans heure restent à la fin.
    for (const list of map.values()) {
      list.sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99"));
    }
    return map;
  }, [entries]);

  const onDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverKey(null);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: { contentId: string; publicationId: string | null };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    startTransition(async () => {
      if (payload.publicationId) {
        await updatePublication(
          payload.publicationId,
          { scheduled_date: targetDate },
          payload.contentId,
        );
      } else {
        await updateContent(payload.contentId, { date: targetDate });
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goto(addMonths(cursor, -1))} aria-label={t("prevMonth")}>
            <ChevronLeft className="size-4 rtl-flip" />
          </Button>
          <h2 className="min-w-44 text-center text-lg font-semibold capitalize">
            {format(cursor, "MMMM yyyy", { locale: dateLocale })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => goto(addMonths(cursor, 1))} aria-label={t("nextMonth")}>
            <ChevronRight className="size-4 rtl-flip" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => goto(new Date())}>
            {t("today")}
          </Button>
        </div>
        <p className="hidden text-xs text-muted md:block">
          {t("dragHint")}
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_2px_12px_-4px_rgba(26,15,37,0.06)]">
        <div className="grid grid-cols-7 border-b border-border/60 bg-secondary/50 text-[11px] font-bold uppercase tracking-wider text-muted">
          {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((d) => (
            <div key={d} className="px-2 py-2.5 text-center">{t(`weekdays.${d}`)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = format(d, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            const otherMonth = !isSameMonth(d, cursor);
            const today = isSameDay(d, new Date());
            const isDragOver = dragOverKey === key;
            return (
              <div
                key={i}
                className={cn(
                  "group relative min-h-28 border-b border-e border-border/60 p-2 transition-all",
                  otherMonth && "bg-secondary/30",
                  (i + 1) % 7 === 0 && "border-e-0",
                  isDragOver && "bg-accent/10 ring-2 ring-accent ring-inset",
                )}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(DRAG_MIME)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverKey !== key) setDragOverKey(key);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverKey === key) setDragOverKey(null);
                }}
                onDrop={(e) => onDrop(e, key)}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                      today && "bg-ink text-white",
                      !today && otherMonth && "text-muted",
                      !today && !otherMonth && "text-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPickedDate(key);
                      setModalOpen(true);
                    }}
                    className="flex size-6 items-center justify-center rounded-full text-muted opacity-0 transition hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
                    aria-label={t("addOnDay")}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {items.slice(0, 3).map((entry) => {
                    const PlatformIcon = entry.platform
                      ? PLATFORM_ICONS[entry.platform]
                      : null;
                    const timeLabel = formatTimeFr(entry.scheduledTime);
                    return (
                      <li key={entry.key} className="relative">
                        <Link
                          href={`/content/${entry.contentId}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData(
                              DRAG_MIME,
                              JSON.stringify({
                                contentId: entry.contentId,
                                publicationId: entry.publicationId,
                              }),
                            );
                            e.dataTransfer.setData("text/plain", entry.title ?? "");
                          }}
                          dir="auto"
                          style={{ borderInlineStartColor: typeColor(entry.type) }}
                          className="block cursor-grab rounded-lg border-s-[3px] bg-secondary/40 p-2 pe-6 transition-colors hover:bg-secondary active:cursor-grabbing"
                        >
                          {/* Plateforme + heure */}
                          {(PlatformIcon || timeLabel) && (
                            <div className="flex items-center gap-1 text-muted">
                              {PlatformIcon && <PlatformIcon className="size-3" />}
                              {timeLabel && (
                                <span className="text-[10px] font-semibold">
                                  {timeLabel}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Nom */}
                          <div className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                            {entry.title || tContent("untitled")}
                          </div>
                          {/* Pilier */}
                          {entry.pillar && (
                            <div className="mt-1">
                              <span className="inline-block max-w-full truncate rounded-md bg-secondary px-1.5 py-0.5 align-middle text-xs font-medium text-foreground/70">
                                {entry.pillar}
                              </span>
                            </div>
                          )}
                          {/* Statut */}
                          <div className="mt-1 flex items-center gap-1.5">
                            <ColorDot color={statusColor(entry.status)} />
                            <span className="text-xs font-medium text-muted">
                              {statusLabel(entry.status)}
                            </span>
                          </div>
                        </Link>
                        {/* Bouton "sibling" (pas nesté dans le <Link>) pour
                            commenter sans quitter le calendrier. */}
                        <div className="absolute end-1 top-1">
                          <ContentCommentsButton
                            contentId={entry.contentId}
                            unreadCount={commentCounts[entry.contentId] ?? 0}
                            className="bg-card/80"
                          />
                        </div>
                      </li>
                    );
                  })}
                  {items.length > 3 && (
                    <li className="px-1 text-xs font-medium text-muted">
                      {t("moreItems", { count: items.length - 3 })}
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <NewContentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultDate={pickedDate}
      />
    </div>
  );
}
