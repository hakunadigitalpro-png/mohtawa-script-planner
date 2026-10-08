"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
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
  clientStatusColor,
  clientStatusLabel,
} from "@/lib/constants";
import { NewContentModal } from "@/components/new-content-modal";
import { ContentCommentsButton } from "@/components/comments";
import { updateContent, updatePublication } from "@/app/(app)/contents/actions";

const DRAG_MIME = "application/x-kreatly-calendar-entry";

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
  /** Null pour une idée sans format encore choisi (0055). */
  type: string | null;
  pillar: string | null;
  status: string;
  /** Première image du contenu, toutes sources confondues (lib/thumbnails). */
  thumbUrl?: string | null;
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
  /** Null pour une idée sans format encore choisi (0055). */
  type: string | null;
  pillar: string | null;
  status: string;
  thumbUrl: string | null;
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
  canEdit = true,
  scopeQuery = "",
}: {
  initialMonth: string; // YYYY-MM-01
  entries: CalendarEntry[];
  /** contentId → nombre de commentaires non lus (badge). */
  commentCounts?: Record<string, number>;
  /**
   * Faux pour un "viewer" (client invité) : pas de création, pas de
   * replanification, et le vocabulaire des statuts passe en 3 mots. Sans
   * ce drapeau le client voyait « Tournage » et « Montage » sur son
   * calendrier et pouvait déplacer les contenus de l'équipe.
   */
  canEdit?: boolean;
  /**
   * Suffixe d'URL décrivant la liste affichée (mois, filtre plateforme).
   * Transporté vers la fiche pour que son « 4 / 17 » et ses flèches restent
   * dans CE périmètre, au lieu de parcourir toute la marque.
   */
  scopeQuery?: string;
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
          thumbUrl: e.thumbUrl ?? null,
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

      {/* Vue grille — desktop. Sur un téléphone, sept colonnes font 50 px
          chacune : ni le visuel ni le titre n'y sont lisibles. */}
      <div className="hidden overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_2px_12px_-4px_rgba(26,15,37,0.06)] md:block">
        <div className="grid grid-cols-7 border-b border-border/60 bg-secondary/50 text-xs font-bold uppercase tracking-wider text-muted">
          {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((d) => (
            <div key={d} className="px-2 py-2.5 text-center">{t(`weekdays.${d}`)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7" data-tour="calendar-grid">
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
                  if (canEdit && e.dataTransfer.types.includes(DRAG_MIME)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverKey !== key) setDragOverKey(key);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverKey === key) setDragOverKey(null);
                }}
                onDrop={(e) => canEdit && onDrop(e, key)}
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
                  {canEdit && (
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
                  )}
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {items.slice(0, 3).map((entry) => (
                    <EntryCard
                      key={entry.key}
                      entry={entry}
                      canEdit={canEdit}
                      unreadCount={commentCounts[entry.contentId] ?? 0}
                      untitled={tContent("untitled")}
                      scopeQuery={scopeQuery}
                    />
                  ))}
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

      {/* Vue agenda — mobile. On ne liste que les jours du mois qui portent
          quelque chose : faire défiler 31 cases vides n'apprend rien. */}
      <div className="space-y-3 md:hidden">
        {days
          .filter((d) => isSameMonth(d, cursor))
          .map((d) => ({ d, key: format(d, "yyyy-MM-dd") }))
          .filter(({ key }) => (byDay.get(key) ?? []).length > 0)
          .map(({ d, key }) => {
            const items = byDay.get(key) ?? [];
            const today = isSameDay(d, new Date());
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    className={cn(
                      "text-sm font-bold capitalize",
                      today ? "text-accent" : "text-foreground",
                    )}
                  >
                    {format(d, "EEEE d", { locale: dateLocale })}
                  </h3>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickedDate(key);
                        setModalOpen(true);
                      }}
                      className="flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-accent hover:text-accent-foreground"
                      aria-label={t("addOnDay")}
                    >
                      <Plus className="size-4" />
                    </button>
                  )}
                </div>
                <ul className="space-y-2 rounded-2xl border border-border/60 bg-card p-2">
                  {items.map((entry) => (
                    <EntryCard
                      key={entry.key}
                      entry={entry}
                      canEdit={canEdit}
                      unreadCount={commentCounts[entry.contentId] ?? 0}
                      untitled={tContent("untitled")}
                      scopeQuery={scopeQuery}
                      agenda
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        {days
          .filter((d) => isSameMonth(d, cursor))
          .every((d) => (byDay.get(format(d, "yyyy-MM-dd")) ?? []).length === 0) && (
          <p className="rounded-2xl border border-border/60 bg-card p-6 text-center text-sm text-muted">
            Rien de prévu ce mois-ci.
          </p>
        )}
      </div>

      {canEdit && (
        <NewContentModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          defaultDate={pickedDate}
        />
      )}
    </div>
  );
}

/**
 * Une carte de contenu, partagée par les deux vues du calendrier.
 *
 * `agenda` bascule la mise en page : en grille (desktop) le visuel est en
 * haut, pleine largeur ; en agenda (mobile) il passe à gauche, en vignette
 * carrée, et le titre récupère toute la largeur restante — sur un téléphone,
 * une colonne de 50 px ne montrerait ni l'image ni le texte.
 */
function EntryCard({
  entry,
  canEdit,
  unreadCount,
  untitled,
  scopeQuery,
  agenda = false,
}: {
  entry: DayCard;
  canEdit: boolean;
  unreadCount: number;
  untitled: string;
  scopeQuery: string;
  agenda?: boolean;
}) {
  // Une seule heure pour tout le groupe : on l'affiche une fois après les
  // icônes. Des heures différentes selon la plateforme : chacune porte la
  // sienne, plutôt qu'un libellé unique qui en trahirait deux sur trois.
  const times = entry.slots
    .map((s) => s.time)
    .filter((t): t is string => Boolean(t));
  const oneTime = new Set(times).size <= 1;
  const sharedTime = oneTime ? formatTimeFr(times[0] ?? null) : null;
  const hasHeader = entry.slots.some((s) => s.platform) || times.length > 0;

  const header = hasHeader && (
    <div className="mb-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-foreground/70">
      {entry.slots.map((slot, si) => {
        const Icon = slot.platform ? PLATFORM_ICONS[slot.platform] : null;
        const own = oneTime ? null : formatTimeFr(slot.time);
        if (!Icon && !own) return null;
        return (
          <span
            key={`${slot.platform ?? "none"}-${si}`}
            className="inline-flex items-center gap-0.5"
            title={slot.platform ? platformLabel(slot.platform) : undefined}
          >
            {Icon && <Icon className="size-3.5" />}
            {own && <span className="text-xs font-semibold">{own}</span>}
          </span>
        );
      })}
      {sharedTime && (
        <span className="text-xs font-semibold text-muted">
          {sharedTime}
        </span>
      )}
    </div>
  );

  const thumb = entry.thumbUrl && (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-secondary",
        agenda ? "size-20" : "mb-1.5 aspect-square w-full",
      )}
    >
      <Image
        src={entry.thumbUrl}
        alt=""
        fill
        sizes={agenda ? "80px" : "(max-width: 768px) 45vw, 180px"}
        className="object-cover object-top"
      />
    </div>
  );

  const body = (
    <>
      {/* Nom. Sans visuel, le titre est la SEULE information : il s'affiche
          en entier. Avec un visuel, l'image identifie déjà le contenu — deux
          lignes suffisent et la grille reste lisible. En agenda la place ne
          manque pas, donc le titre reste toujours entier. */}
      <div
        className={cn(
          "text-sm font-semibold leading-snug text-foreground",
          entry.thumbUrl && !agenda ? "line-clamp-2" : "break-words",
        )}
      >
        {entry.title || untitled}
      </div>
      {/* Pilier + statut sur une seule ligne : ce que le titre prend en
          hauteur, les métadonnées le rendent. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {entry.pillar && (
          <span className="max-w-full truncate rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-foreground/70">
            {entry.pillar}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <ColorDot
            color={
              canEdit
                ? statusColor(entry.status)
                : clientStatusColor(entry.status)
            }
          />
          <span className="text-xs font-medium text-muted">
            {canEdit ? statusLabel(entry.status) : clientStatusLabel(entry.status)}
          </span>
        </span>
      </div>
    </>
  );

  return (
    <li className="relative">
      <Link
        href={`/content/${entry.contentId}${scopeQuery}`}
        // Le glisser-déposer n'a pas de sens au doigt : en agenda la carte
        // n'est jamais draggable, quel que soit le rôle.
        draggable={canEdit && !agenda}
        onDragStart={(e) => {
          if (!canEdit || agenda) return;
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
        className={cn(
          "block rounded-lg border-s-[3px] bg-secondary/40 p-2 pe-8 transition-colors hover:bg-secondary",
          canEdit && !agenda && "cursor-grab active:cursor-grabbing",
          agenda && "flex items-start gap-3",
        )}
      >
        {agenda ? (
          <>
            {thumb}
            <div className="min-w-0 flex-1">
              {header}
              {body}
            </div>
          </>
        ) : (
          <>
            {header}
            {thumb}
            {body}
          </>
        )}
      </Link>
      {/* Bouton "sibling" (pas nesté dans le <Link>) pour commenter sans
          quitter le calendrier. */}
      <div className="absolute end-1 top-1">
        <ContentCommentsButton
          contentId={entry.contentId}
          unreadCount={unreadCount}
          className="bg-card/80"
        />
      </div>
    </li>
  );
}
