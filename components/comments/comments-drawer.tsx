"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Send,
  CornerDownRight,
  Trash2,
  Check,
  RotateCcw,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createComment,
  replyToComment,
  toggleCommentResolved,
  deleteComment,
  markContentRead,
} from "@/app/(app)/contents/comment-actions";
import { useComments } from "./comments-provider";
import type { Comment, CommentTargetType } from "./types";

type TargetLabels = Record<string, string>;

/**
 * Drawer global de commentaires (panneau latéral droit).
 * 2 modes :
 *   - "thread" : un seul thread (un item commentable) avec form
 *   - "inbox"  : liste de tous les threads, filtrable
 */
export function CommentsDrawer({
  targetLabels,
}: {
  targetLabels: TargetLabels;
}) {
  const { drawer, closeDrawer, contentId } = useComments();
  const router = useRouter();

  // Marque la vidéo comme lue à l'ouverture du drawer
  React.useEffect(() => {
    if (drawer.open) {
      markContentRead(contentId).then(() => router.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.open, contentId]);

  // ESC pour fermer
  React.useEffect(() => {
    if (!drawer.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer.open, closeDrawer]);

  if (!drawer.open) return null;

  return (
    <>
      {/* Backdrop : moins envahissant qu'une vraie modal */}
      <div
        className="fixed inset-0 z-40 bg-ink/10"
        onClick={closeDrawer}
        aria-hidden
      />

      {/* Panel */}
      <aside className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s border-border/60 bg-card shadow-[0_0_60px_-10px_rgba(10,6,18,0.25)]">
        {drawer.mode === "thread" ? (
          <ThreadView
            targetType={drawer.targetType}
            targetId={drawer.targetId}
            targetLabels={targetLabels}
            onClose={closeDrawer}
          />
        ) : (
          <InboxView
            filter={drawer.filter}
            targetLabels={targetLabels}
            onClose={closeDrawer}
          />
        )}
      </aside>
    </>
  );
}

// ============================================================
// Mode "Thread" — un seul thread
// ============================================================
function ThreadView({
  targetType,
  targetId,
  targetLabels,
  onClose,
}: {
  targetType: CommentTargetType;
  targetId: string;
  targetLabels: TargetLabels;
  onClose: () => void;
}) {
  const { comments, openInbox, contentId, refresh, currentUserId } = useComments();
  const router = useRouter();

  const targetLabel =
    targetLabels[`${targetType}:${targetId}`] ?? defaultLabel(targetType, targetId);

  // Threads racines pour ce target
  const roots = comments
    .filter(
      (c) =>
        c.parent_id === null &&
        c.target_type === targetType &&
        c.target_id === targetId,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Map parentId → replies
  const replyMap = React.useMemo(() => {
    const m = new Map<string, Comment[]>();
    for (const c of comments) {
      if (c.parent_id) {
        const arr = m.get(c.parent_id) ?? [];
        arr.push(c);
        m.set(c.parent_id, arr);
      }
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return m;
  }, [comments]);

  return (
    <>
      <DrawerHeader
        title={targetLabel}
        subtitle={`${roots.length} commentaire${roots.length > 1 ? "s" : ""}`}
        onClose={onClose}
        leftAction={
          <button
            type="button"
            onClick={() => openInbox("all")}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-secondary hover:text-foreground"
            aria-label="Retour à l'inbox"
          >
            <Inbox className="size-4" />
          </button>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {roots.length === 0 && (
          <EmptyState
            title="Aucun commentaire ici"
            description="Lance la discussion en ajoutant le premier commentaire."
          />
        )}
        {roots.map((root) => (
          <CommentThread
            key={root.id}
            root={root}
            replies={replyMap.get(root.id) ?? []}
            currentUserId={currentUserId}
            contentId={contentId}
            onChanged={() => {
              refresh();
              router.refresh();
            }}
          />
        ))}
      </div>

      <div className="border-t border-border/60 bg-secondary/30 p-4">
        <NewCommentForm
          contentId={contentId}
          targetType={targetType}
          targetId={targetId}
          onSubmitted={() => {
            refresh();
            router.refresh();
          }}
        />
      </div>
    </>
  );
}

// ============================================================
// Mode "Inbox" — vue globale, comme Boords
// ============================================================
function InboxView({
  filter: initialFilter,
  targetLabels,
  onClose,
}: {
  filter: "all" | "unread" | "resolved";
  targetLabels: TargetLabels;
  onClose: () => void;
}) {
  const { comments, openThread, currentUserId, lastReadAt } = useComments();
  const [filter, setFilter] = React.useState<"all" | "unread" | "resolved">(
    initialFilter,
  );

  // On regroupe par target. Chaque "thread" dans l'inbox = un commentaire racine + meta.
  const roots = comments
    .filter((c) => c.parent_id === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)); // les plus récents en haut

  const replyCountByRoot = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comments) {
      if (c.parent_id) m.set(c.parent_id, (m.get(c.parent_id) ?? 0) + 1);
    }
    return m;
  }, [comments]);

  // Calcul : un thread est "non lu" si au moins un de ses commentaires (root ou reply)
  // a été créé après lastReadAt et n'est pas de moi.
  const isThreadUnread = React.useCallback(
    (root: Comment) => {
      const items = comments.filter(
        (c) => c.id === root.id || c.parent_id === root.id,
      );
      return items.some(
        (c) => c.user_id !== currentUserId && c.created_at > lastReadAt,
      );
    },
    [comments, currentUserId, lastReadAt],
  );

  const filtered = roots.filter((root) => {
    if (filter === "unread") return isThreadUnread(root) && !root.resolved;
    if (filter === "resolved") return root.resolved;
    return true; // all
  });

  return (
    <>
      <DrawerHeader
        title="Commentaires"
        subtitle="Toute la discussion sur cette vidéo"
        onClose={onClose}
      />

      <div className="border-b border-border/60 bg-secondary/30 px-5 py-3">
        <div className="flex gap-1.5">
          {(
            [
              { value: "all", label: "Tous" },
              { value: "unread", label: "Non lus" },
              { value: "resolved", label: "Résolus" },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition",
                filter === f.value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:bg-secondary hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.length === 0 && (
          <div className="px-2 py-12">
            <EmptyState
              title={
                filter === "unread"
                  ? "Pas de commentaire non lu"
                  : filter === "resolved"
                  ? "Pas de commentaire résolu"
                  : "Pas encore de commentaire"
              }
              description="Clique sur le bouton 💬 d'un bloc pour démarrer la discussion."
            />
          </div>
        )}

        {filtered.map((root) => {
          const targetLabel =
            targetLabels[`${root.target_type}:${root.target_id}`] ??
            defaultLabel(root.target_type, root.target_id);
          const replies = replyCountByRoot.get(root.id) ?? 0;
          const unread = isThreadUnread(root) && !root.resolved;

          return (
            <button
              key={root.id}
              type="button"
              onClick={() => openThread(root.target_type, root.target_id)}
              className={cn(
                "block w-full rounded-2xl border p-3 text-start transition hover:border-accent/30 hover:bg-secondary/50",
                unread
                  ? "border-accent/30 bg-accent/5"
                  : "border-border/60 bg-card",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
                  {targetLabel}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {root.resolved && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <Check className="size-3" /> Résolu
                    </span>
                  )}
                  <span>{relativeTimeFr(root.created_at)}</span>
                </div>
              </div>
              <div className="mt-1.5 text-sm font-medium text-foreground">
                {root.author_email.split("@")[0]}
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm text-foreground/80">
                {root.body}
              </p>
              {replies > 0 && (
                <div className="mt-2 text-xs text-muted">
                  {replies} réponse{replies > 1 ? "s" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ============================================================
// Sous-composants partagés
// ============================================================
function DrawerHeader({
  title,
  subtitle,
  onClose,
  leftAction,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  leftAction?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
      {leftAction}
      <div className="flex-1">
        <div className="text-base font-bold tracking-tight text-foreground">
          {title}
        </div>
        {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-secondary hover:text-foreground"
        aria-label="Fermer"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function CommentThread({
  root,
  replies,
  currentUserId,
  contentId,
  onChanged,
}: {
  root: Comment;
  replies: Comment[];
  currentUserId: string;
  contentId: string;
  onChanged: () => void;
}) {
  const [replying, setReplying] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        root.resolved
          ? "border-border/40 bg-secondary/20 opacity-80"
          : "border-border/60 bg-card",
      )}
    >
      <CommentItem
        comment={root}
        isRoot
        isOwner={root.user_id === currentUserId}
        contentId={contentId}
        onChanged={onChanged}
      />

      {replies.length > 0 && (
        <div className="mt-3 space-y-3 border-s-2 border-border/40 ps-4">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              isRoot={false}
              isOwner={r.user_id === currentUserId}
              contentId={contentId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      <div className="mt-3 ps-1">
        {replying ? (
          <ReplyForm
            parentId={root.id}
            contentId={contentId}
            onCancel={() => setReplying(false)}
            onSubmitted={() => {
              setReplying(false);
              onChanged();
            }}
          />
        ) : (
          !root.resolved && (
            <button
              type="button"
              onClick={() => setReplying(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
            >
              <CornerDownRight className="size-3 rtl-flip" />
              Répondre
            </button>
          )
        )}
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  isRoot,
  isOwner,
  contentId,
  onChanged,
}: {
  comment: Comment;
  isRoot: boolean;
  isOwner: boolean;
  contentId: string;
  onChanged: () => void;
}) {
  const [pending, startTransition] = React.useTransition();

  const onToggleResolve = () => {
    startTransition(async () => {
      await toggleCommentResolved({
        commentId: comment.id,
        contentId,
        resolved: !comment.resolved,
      });
      onChanged();
    });
  };

  const onDelete = () => {
    if (!confirm("Supprimer ce commentaire ?\n\nLes éventuelles réponses seront aussi supprimées.")) return;
    startTransition(async () => {
      await deleteComment({ commentId: comment.id, contentId });
      onChanged();
    });
  };

  const authorShort = comment.author_email?.split("@")[0] ?? "anon";

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold uppercase">
          {authorShort.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-foreground">{authorShort}</span>
            <span className="text-muted">·</span>
            <span className="text-muted">{relativeTimeFr(comment.created_at)}</span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
            {comment.body}
          </p>
        </div>
      </div>

      {(isRoot || isOwner) && (
        <div className="mt-1.5 flex items-center gap-1 ps-9">
          {isRoot && (
            <button
              type="button"
              onClick={onToggleResolve}
              disabled={pending}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition",
                comment.resolved
                  ? "text-muted hover:bg-secondary hover:text-foreground"
                  : "text-emerald-700 hover:bg-emerald-50",
              )}
            >
              {comment.resolved ? (
                <>
                  <RotateCcw className="size-3" /> Rouvrir
                </>
              ) : (
                <>
                  <Check className="size-3" /> Résoudre
                </>
              )}
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3" /> Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NewCommentForm({
  contentId,
  targetType,
  targetId,
  onSubmitted,
}: {
  contentId: string;
  targetType: CommentTargetType;
  targetId: string;
  onSubmitted: () => void;
}) {
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createComment({
        contentId,
        targetType,
        targetId,
        body,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setBody("");
      onSubmitted();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Écris un commentaire pour ton équipe…"
        rows={3}
        className="resize-none"
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          <Send className="size-3.5" />
          {pending ? "Envoi…" : "Envoyer"}
        </Button>
      </div>
    </form>
  );
}

function ReplyForm({
  parentId,
  contentId,
  onCancel,
  onSubmitted,
}: {
  parentId: string;
  contentId: string;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await replyToComment({ parentId, contentId, body });
      if ("ok" in res && res.ok) {
        setBody("");
        onSubmitted();
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Réponse…"
        rows={2}
        autoFocus
        className="resize-none text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? "Envoi…" : "Envoyer"}
        </Button>
      </div>
    </form>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted">{description}</p>
    </div>
  );
}

// ============================================================
// Helpers locaux
// ============================================================
function defaultLabel(type: CommentTargetType, id: string): string {
  if (type === "plan") return `Plan · ${prettyPlanField(id)}`;
  if (type === "script") return `Script · ${prettyScriptField(id)}`;
  if (type === "scene") return "Scène";
  if (type === "slide") return `Story · slot ${id}`;
  return type;
}

const PLAN_FIELDS: Record<string, string> = {
  general: "Infos générales",
  title: "Titre",
  hook: "Accroche",
  cta: "Appel à l'action",
  tags: "Tags",
  pillar: "Pilier",
  objective: "Objectif",
  date: "Date",
};

function prettyPlanField(id: string) {
  return PLAN_FIELDS[id] ?? id;
}

const SCRIPT_FIELDS: Record<string, string> = {
  intro: "Intro",
  point1: "Point 1",
  point2: "Point 2",
  point3: "Point 3",
  transition: "Transition",
  recap: "Récap",
  outro: "Outro",
  script_full: "Script complet",
};

function prettyScriptField(id: string) {
  return SCRIPT_FIELDS[id] ?? id;
}

function relativeTimeFr(iso: string): string {
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// CornerDownRight icon is already imported, just unused import warning fix:
void ArrowLeft;
