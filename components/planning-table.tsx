"use client";

import * as React from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Film, X, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  statusColor,
  statusLabel,
  platformLabel,
} from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";
import { ContentCommentsButton } from "@/components/comments";
import type { Content } from "@/lib/types";

/**
 * Vue « Planning » — le tableau global du mois : tous les contenus (posts,
 * carrousels, vidéos) en lignes, groupés par semaine, avec Jour / Date /
 * Plateforme / Statut / Légende / Vidéo / Titre + visuel. La tour de
 * contrôle éditoriale (équivalent du tableau Notion).
 *
 * Client component : la cellule Légende ouvre directement l'onglet Légende
 * de la fiche, et la vignette s'agrandit sur place dans une lightbox. Le
 * reste de la ligne ouvre la fiche sur l'onglet Plan.
 */

/** Jour de la semaine abrégé en français (lun, mar…). */
function dayShortFr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
}

export function PlanningTable({
  contents,
  commentCounts = {},
  thumbs = {},
  scopeQuery = "",
  groupBy = "week",
  emptyState,
}: {
  contents: Content[];
  /** contentId → nombre de commentaires non lus (badge). */
  commentCounts?: Record<string, number>;
  /** contentId → première image du contenu (lib/thumbnails). */
  thumbs?: Record<string, string>;
  /** Périmètre transporté vers la fiche (mois affiché). */
  scopeQuery?: string;
  /** Par semaine dans un mois ; par mois quand la liste traverse les mois. */
  groupBy?: "week" | "month";
  /** Ce que dit la boîte vide, quand « Aucun contenu ce mois-ci » serait faux. */
  emptyState?: ReactNode;
}) {
  const router = useRouter();
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  // Lecture d'une légende dans une popup — contient le contenu (pour
  // le texte) et l'id (pour que le bouton crayon mène à sa fiche).
  const [captionReader, setCaptionReader] =
    React.useState<{ id: string; title: string | null; caption: string | null } | null>(null);

  // ESC ferme la lightbox — reproduit la convention des modales de l'app.
  React.useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const sorted = [...contents].sort((a, b) =>
    (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99"),
  );

  const groups: { label: string; items: Content[] }[] = [];
  const idxByLabel = new Map<string, number>();
  for (const c of sorted) {
    const label =
      groupBy === "month"
        ? c.date
          ? new Date(c.date).toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
            })
          : "Sans date"
        : `Semaine ${Math.ceil(Number((c.date ?? "").slice(8, 10)) / 7)}`;
    let gi = idxByLabel.get(label);
    if (gi === undefined) {
      gi = groups.length;
      groups.push({ label, items: [] });
      idxByLabel.set(label, gi);
    }
    groups[gi].items.push(c);
  }

  if (contents.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted">
        {emptyState ?? "Aucun contenu ce mois-ci. Crée-en un avec « Nouveau »."}
      </div>
    );
  }

  // Jour · Date · Plateforme · Statut · Légende · Vidéo · Titre+Visuel
  const cols =
    "grid-cols-[60px_100px_110px_120px_minmax(0,1.5fr)_70px_minmax(0,1.6fr)]";

  // Un clic sur la ligne (hors cellules spéciales) ouvre la fiche. On
  // intercepte les ouvertures de nouvel onglet (Ctrl/Cmd/middle-click) pour
  // laisser le comportement natif aux utilisateurs qui connaissent.
  const openFiche = (id: string, tab?: string) => {
    const sep = scopeQuery ? "&" : "?";
    const tabQs = tab ? `${scopeQuery || ""}${sep}tab=${tab}` : scopeQuery;
    router.push(`/content/${id}${tabQs}`);
  };

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <div className="min-w-[900px]">
          <div
            className={`grid ${cols} gap-3 border-b border-border/60 bg-secondary/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted`}
          >
            <div>Jour</div>
            <div>Date</div>
            <div>Plateforme</div>
            <div>Statut</div>
            <div>Légende</div>
            <div>Vidéo</div>
            <div>Titre</div>
          </div>

          {groups.map((g) => (
            <div key={g.label}>
              <div className="bg-secondary/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                {g.label}
              </div>
              {g.items.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openFiche(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openFiche(c.id);
                    }
                  }}
                  className={`relative grid ${cols} cursor-pointer items-center gap-3 border-b border-border/40 px-4 py-3 pe-10 text-sm transition last:border-b-0 hover:bg-secondary/40`}
                >
                  <span className="font-medium capitalize text-foreground/80">
                    {dayShortFr(c.date)}
                  </span>
                  <span className="text-muted">
                    {c.date ? formatDateFr(c.date) : "—"}
                  </span>
                  <span className="truncate text-muted">
                    {c.platform ? platformLabel(c.platform) : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: statusColor(c.status) }}
                    />
                    {statusLabel(c.status)}
                  </span>
                  {/* Clic sur la légende → popup lecture avec un crayon
                      pour aller la modifier. Vide → on va directement
                      à l'onglet Légende pour la rédiger. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (c.caption?.trim()) {
                        setCaptionReader({
                          id: c.id,
                          title: c.title,
                          caption: c.caption,
                        });
                      } else {
                        openFiche(c.id, "caption");
                      }
                    }}
                    className="min-w-0 truncate text-start text-foreground/70 hover:text-foreground"
                    title={c.caption ?? "Rédiger la légende"}
                  >
                    {c.caption?.trim() || (
                      <span className="text-muted">— ajouter une légende</span>
                    )}
                  </button>
                  {/* Icône cliquable → la vidéo externe. */}
                  <span className="inline-flex">
                    {c.preview_url ? (
                      <a
                        href={c.preview_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex size-8 items-center justify-center rounded-full text-foreground/70 transition hover:bg-secondary hover:text-foreground"
                        title="Ouvrir la vidéo"
                        aria-label="Ouvrir la vidéo"
                      >
                        <Film className="size-4" />
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    {thumbs[c.id] ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightbox(thumbs[c.id]);
                        }}
                        className="relative size-9 shrink-0 cursor-zoom-in overflow-hidden rounded-md transition hover:ring-2 hover:ring-accent"
                        title="Agrandir le visuel"
                        aria-label="Agrandir le visuel"
                      >
                        <Image
                          src={thumbs[c.id]}
                          alt=""
                          width={72}
                          height={72}
                          className="size-9 object-cover object-top"
                        />
                      </button>
                    ) : (
                      <span className="size-9 shrink-0 rounded-md bg-secondary" />
                    )}
                    <span
                      className="truncate font-medium text-foreground"
                      dir="auto"
                    >
                      {c.title || "Sans titre"}
                    </span>
                  </span>
                  {/* Commenter sans quitter le Planning. */}
                  <div
                    className="absolute end-3 top-1/2 -translate-y-1/2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ContentCommentsButton
                      contentId={c.id}
                      unreadCount={commentCounts[c.id] ?? 0}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Popup lecture de la légende : on la lit en entier sans quitter
          le Planning ; le crayon ouvre l'onglet Légende pour modifier. */}
      <Dialog open={Boolean(captionReader)} onOpenChange={(o) => !o && setCaptionReader(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Légende{captionReader?.title ? ` · ${captionReader.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p
              dir="auto"
              className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-secondary/40 p-4 text-sm leading-relaxed text-foreground"
            >
              {captionReader?.caption}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCaptionReader(null)}
            >
              Fermer
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={() => {
                const id = captionReader?.id;
                setCaptionReader(null);
                if (id) openFiche(id, "caption");
              }}
            >
              <Pencil className="size-4" />
              Modifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox : agrandissement du visuel en superposition, cliquer
          l'arrière-plan ou Échap pour fermer. */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute end-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Fermer l'aperçu"
          >
            <X className="size-5" />
          </button>
          <div
            className="relative h-[88vh] w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
