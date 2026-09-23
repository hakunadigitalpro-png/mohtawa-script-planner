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
import {
  typeColor,
  statusColor,
  statusLabel,
  platformLabel,
} from "@/lib/constants";
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

/**
 * Ce qui s'affiche réellement : UN contenu sur UNE journée, toutes ses
 * plateformes réunies. Le même post prévu le 10 sur Instagram et Facebook
 * faisait deux cartes identiques empilées — on ne voyait plus que c'était le
 * même contenu, et la journée paraissait deux fois plus chargée. Les icônes
 * portent maintenant l'information « où ça part ».
 *
 * Un contenu réparti sur PLUSIEURS jours reste, lui, sur plusieurs cartes :
 * ce sont bien deux moments différents du planning.
 */
type DayCard = {
  key: string;
  contentId: string;
  /** Les publications de ce jour-là — le glisser-déposer les déplace toutes. */
  publicationIds: string[];
  slots: { platform: string | null; time: string | null }[];
  title: string | null;
  type: string;
  pillar: string | null;
  status: string;
};

/** L'heure la plus tôt du groupe, pour ordonner les cartes d'une journée. */
function earliestTime(card: DayCard): string {
  return card.slots[0]?.time ?? "99:99";
}

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
    // Deux niveaux : la journée, puis le contenu dans cette journée.
    const grouped = new Map<string, Map<string, DayCard>>();
    for (const e of entries) {
      const day = e.scheduledDate.slice(0, 10);
      let cards = grouped.get(day);
      if (!cards) {
        cards = new Map();
        grouped.set(day, cards);
      }
      let card = cards.get(e.contentId);
      if (!card) {
        card = {
          key: `${e.contentId}:${day}`,
          contentId: e.contentId,
          publicationIds: [],
          slots: [],
          title: e.title,
          type: e.type,
          pillar: e.pillar,
          status: e.status,
        };
        cards.set(e.contentId, card);
      }
      if (e.publicationId) card.publicationIds.push(e.publicationId);
      card.slots.push({ platform: e.platform, time: e.scheduledTime });
    }

    const out = new Map<string, DayCard[]>();
    for (const [day, cards] of grouped) {
      const list = [...cards.values()];
      for (const card of list) {
        // Les plateformes avec heure d'abord, dans l'ordre de la journée ;
        // celles sans heure à la fin.
        card.slots.sort((a, b) =>
          (a.time ?? "99:99").localeCompare(b.time ?? "99:99"),
        );
      }
      list.sort((a, b) => earliestTime(a).localeCompare(earliestTime(b)));
      out.set(day, list);
    }
    return out;
  }, [entries]);

  const onDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverKey(null);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: { contentId: string; publicationIds: string[] };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    startTransition(async () => {
      // Une carte regroupe toutes les plateformes du jour : la déplacer les
      // replanifie ensemble, sinon on casserait en deux ce qui s'affiche
      // comme un seul bloc.
      if (payload.publicationIds?.length) {
        for (const id of payload.publicationIds) {
          await updatePublication(
            id,
            { scheduled_date: targetDate },
            payload.contentId,
          );
        }
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
                    // Une seule heure pour tout le groupe : on l'affiche une
                    // fois après les icônes. Des heures différentes selon la
                    // plateforme : chacune porte la sienne, plutôt qu'un
                    // libellé unique qui en trahirait deux sur trois.
                    const times = entry.slots
                      .map((s) => s.time)
                      .filter((t): t is string => Boolean(t));
                    const oneTime = new Set(times).size <= 1;
                    const sharedTime = oneTime ? formatTimeFr(times[0] ?? null) : null;
                    const hasHeader =
                      entry.slots.some((s) => s.platform) || times.length > 0;
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
                                publicationIds: entry.publicationIds,
                              }),
                            );
                            e.dataTransfer.setData("text/plain", entry.title ?? "");
                          }}
                          dir="auto"
                          style={{ borderInlineStartColor: typeColor(entry.type) }}
                          className="block cursor-grab rounded-lg border-s-[3px] bg-secondary/40 p-2 pe-6 transition-colors hover:bg-secondary active:cursor-grabbing"
                        >
                          {/* Plateformes + heure(s) */}
                          {hasHeader && (
                            <div className="mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-foreground/70">
                              {entry.slots.map((slot, si) => {
                                const Icon = slot.platform
                                  ? PLATFORM_ICONS[slot.platform]
                                  : null;
                                const own = oneTime
                                  ? null
                                  : formatTimeFr(slot.time);
                                if (!Icon && !own) return null;
                                return (
                                  <span
                                    key={`${slot.platform ?? "none"}-${si}`}
                                    className="inline-flex items-center gap-0.5"
                                    title={
                                      slot.platform
                                        ? platformLabel(slot.platform)
                                        : undefined
                                    }
                                  >
                                    {Icon && <Icon className="size-3.5" />}
                                    {own && (
                                      <span className="text-[10px] font-semibold">
                                        {own}
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                              {sharedTime && (
                                <span className="text-[10px] font-semibold text-muted">
                                  {sharedTime}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Nom — en entier. Le titre EST l'information :
                              quand il s'agit d'une question, la couper à deux
                              lignes oblige à ouvrir la fiche pour savoir de
                              quoi parle la vidéo. `break-words` protège la
                              grille d'une URL ou d'un mot à rallonge. */}
                          <div className="break-words text-sm font-semibold leading-snug text-foreground">
                            {entry.title || tContent("untitled")}
                          </div>
                          {/* Pilier + statut sur une seule ligne : ce que le
                              titre prend en hauteur, les métadonnées le
                              rendent. */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {entry.pillar && (
                              <span className="max-w-full truncate rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-foreground/70">
                                {entry.pillar}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <ColorDot color={statusColor(entry.status)} />
                              <span className="text-xs font-medium text-muted">
                                {statusLabel(entry.status)}
                              </span>
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
