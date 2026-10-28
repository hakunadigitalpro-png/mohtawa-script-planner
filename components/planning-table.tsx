"use client";

import * as React from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Film, X, Pencil, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createComment } from "@/app/(app)/contents/comment-actions";
import {
  statusColor,
  statusLabel,
  platformLabel,
} from "@/lib/constants";
import { platformAccentColor } from "@/lib/platform-colors";
import { formatDateFr } from "@/lib/utils";
import { ContentCommentsButton } from "@/components/comments";
import type { Content } from "@/lib/types";

/**
 * Pastille colorée pour le statut : utilise la couleur sémantique du
 * statut (CSS var `--color-status-*`) à 15 % d'opacité en fond + 100 % en
 * texte, pour la lisibilité des deux thèmes sans toucher aux tokens.
 */
function StatusChip({ status }: { status: string | null | undefined }) {
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`,
        color: `color-mix(in oklab, ${color} 80%, var(--color-ink, #0A0612) 20%)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {statusLabel(status)}
    </span>
  );
}

/**
 * Pastille colorée pour la plateforme : fond pastel à l'accent plateforme.
 */
function PlatformChip({ platform }: { platform: string | null | undefined }) {
  if (!platform) return <span className="text-muted">—</span>;
  const color = platformAccentColor(platform);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
        color: `color-mix(in oklab, ${color} 80%, var(--color-ink, #0A0612) 20%)`,
      }}
    >
      {platformLabel(platform)}
    </span>
  );
}

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

/**
 * Panneau de commentaires attaché à la popup lecture de la légende :
 * liste les remarques existantes sur la cible `plan:caption` et laisse
 * l'utilisatrice (ou le client invité) en ajouter sans ouvrir la fiche.
 * Charge à la demande (une seule fois par popup ouverte), poste via
 * la Server Action `createComment`.
 */
function CaptionCommentPanel({ contentId }: { contentId: string }) {
  type Row = {
    id: string;
    body: string;
    created_at: string;
    author_email: string;
    target_type: string;
    target_id: string;
  };
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [draft, setDraft] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const supabase = createBrowserClient();
    const { data } = await supabase.rpc(
      "list_content_comments_with_authors",
      { p_content_id: contentId },
    );
    const all = (data ?? []) as Row[];
    setRows(all.filter((c) => c.target_type === "plan" && c.target_id === "caption"));
  }, [contentId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await createComment({
        contentId,
        targetType: "plan",
        targetId: "caption",
        body,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setDraft("");
      load();
    });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
        Remarques sur la légende
      </h3>
      {rows === null ? (
        <p className="text-xs italic text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs italic text-muted">
          Pas encore de remarque.
        </p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto">
          {rows.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-foreground/10 bg-card p-2 text-sm"
            >
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">
                {c.author_email}
              </p>
              <p className="whitespace-pre-wrap text-foreground/80" dir="auto">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Ta remarque sur la légende…"
        rows={2}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={send}
          disabled={pending || !draft.trim()}
        >
          <Send className="size-3.5" />
          Envoyer
        </Button>
      </div>
    </div>
  );
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
  // Tri par colonne : clic sur un en-tête bascule asc→desc→off. Pose un
  // sortedOverride qui, s'il est défini, remplace le tri par date par
  // défaut (et désactive le groupement par semaine/mois).
  const [sortCol, setSortCol] = React.useState<
    "date" | "platform" | "status" | "title" | null
  >(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
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

  // Tri par défaut : par date croissante (= le groupement par semaine
  // tient la route). Dès que l'utilisatrice clique un en-tête, on passe
  // en mode « liste plate » : plus de groupement, on respecte juste son
  // tri — comme Airtable.
  const sorted = [...contents];
  if (sortCol === null) {
    sorted.sort((a, b) =>
      (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99"),
    );
  } else {
    const dir = sortDir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      const av =
        sortCol === "date"
          ? a.date ?? ""
          : sortCol === "platform"
            ? a.platform ?? ""
            : sortCol === "status"
              ? a.status ?? ""
              : (a.title ?? "").toLowerCase();
      const bv =
        sortCol === "date"
          ? b.date ?? ""
          : sortCol === "platform"
            ? b.platform ?? ""
            : sortCol === "status"
              ? b.status ?? ""
              : (b.title ?? "").toLowerCase();
      return av.localeCompare(bv) * dir;
    });
  }

  const toggleSort = (col: "date" | "platform" | "status" | "title") => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortCol(null);
    }
  };

  const sortArrow = (col: "date" | "platform" | "status" | "title") =>
    sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const groups: { label: string; items: Content[] }[] = [];
  const idxByLabel = new Map<string, number>();
  // Pas de groupement quand on trie à la main — l'utilisatrice veut lire
  // sa liste dans son ordre, pas la voir recassée en semaines.
  if (sortCol !== null) {
    groups.push({ label: "", items: sorted });
  } else
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
    // Choix de l'onglet par défaut en fonction du type du contenu :
    //   - vidéo (reel / story / vlog) → onglet « Vidéo » (lien externe
    //     + aperçu du média)
    //   - sinon → onglet « Contenu » (visuels + légende)
    // On lit le type depuis la liste `contents` pour ne pas devoir
    // repasser par l'URL.
    const c = contents.find((x) => x.id === id);
    const def =
      c?.type === "reel" || c?.type === "story" || c?.type === "vlog"
        ? "video"
        : "content";
    const t = tab ?? def;
    const sep = scopeQuery ? "&" : "?";
    const tabQs = `${scopeQuery || ""}${sep}tab=${t}`;
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
            <button
              type="button"
              onClick={() => toggleSort("date")}
              className="text-start hover:text-foreground"
            >
              Date{sortArrow("date")}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("platform")}
              className="text-start hover:text-foreground"
            >
              Plateforme{sortArrow("platform")}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("status")}
              className="text-start hover:text-foreground"
            >
              Statut{sortArrow("status")}
            </button>
            <div>Légende</div>
            <div>Vidéo</div>
            <button
              type="button"
              onClick={() => toggleSort("title")}
              className="text-start hover:text-foreground"
            >
              Titre{sortArrow("title")}
            </button>
          </div>

          {groups.map((g) => (
            <div key={g.label || "flat"}>
              {g.label && (
                <div className="bg-secondary/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                  {g.label}
                </div>
              )}
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
                  <span className="min-w-0 truncate">
                    <PlatformChip platform={c.platform} />
                  </span>
                  <span className="min-w-0 truncate">
                    <StatusChip status={c.status} />
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
                  {/* Commenter sans quitter le Planning. On centrait avec
                      `translate-y-1/2` : ce transform créait un nouveau
                      containing block pour position:fixed, et le panneau
                      des commentaires s'affichait collé à la ligne au lieu
                      de prendre tout l'écran. On passe en flex-center. */}
                  <div
                    className="absolute inset-y-0 end-3 flex items-center"
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

      {/* Popup lecture de la légende : texte en grand pour lire, liste
          des commentaires existants sur la légende, et zone pour en
          laisser un sans quitter le Planning. Le crayon ouvre l'onglet
          Légende pour modifier. Même workflow pour le client invité
          (qui n'a pas le crayon). */}
      <Dialog open={Boolean(captionReader)} onOpenChange={(o) => !o && setCaptionReader(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Légende{captionReader?.title ? ` · ${captionReader.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p
              dir="auto"
              className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-secondary/40 p-4 text-sm leading-relaxed text-foreground"
            >
              {captionReader?.caption}
            </p>
            {captionReader && (
              <CaptionCommentPanel contentId={captionReader.id} />
            )}
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
