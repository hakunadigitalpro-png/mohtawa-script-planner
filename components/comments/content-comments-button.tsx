"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CommentsProvider, useComments } from "./comments-provider";
import { CommentsDrawer } from "./comments-drawer";
import type { Comment } from "./types";

/**
 * Bouton "commentaires" indépendant, à poser sur une carte Calendrier ou une
 * ligne Planning — SANS avoir à ouvrir la fiche complète du contenu.
 *
 * `<CommentsProvider>` a été pensé pour vivre une fois par page (fiche
 * vidéo) ; ici on le monte à la demande, seulement au clic, pour ne pas
 * ouvrir un canal Realtime + charger les commentaires de CHAQUE contenu
 * visible sur tout un mois. `unreadCount` (badge) vient d'une requête en
 * masse faite une fois par la page (RPC `count_unread_comments`).
 */
export function ContentCommentsButton({
  contentId,
  unreadCount = 0,
  className,
}: {
  contentId: string;
  unreadCount?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Commentaires"
        className={cn(
          "relative inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-secondary hover:text-foreground",
          unreadCount > 0 && "text-accent",
          className,
        )}
      >
        <MessageSquare className="size-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <ContentCommentsLoader
          contentId={contentId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Charge les commentaires de CE contenu (à la demande) puis affiche l'inbox. */
function ContentCommentsLoader({
  contentId,
  onClose,
}: {
  contentId: string;
  onClose: () => void;
}) {
  const [data, setData] = React.useState<{
    comments: Comment[];
    lastReadAt: string;
    currentUserId: string;
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const [
        {
          data: { user },
        },
        commentsRes,
        readRes,
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("list_content_comments_with_authors", {
          p_content_id: contentId,
        }),
        supabase
          .from("content_reads")
          .select("last_comment_read_at")
          .eq("content_id", contentId)
          .maybeSingle(),
      ]);
      if (!active || !user) return;
      setData({
        comments: (commentsRes.data ?? []) as Comment[],
        lastReadAt:
          readRes.data?.last_comment_read_at ?? "1970-01-01T00:00:00Z",
        currentUserId: user.id,
      });
    })();
    return () => {
      active = false;
    };
  }, [contentId]);

  if (!data) return null;

  return (
    <CommentsProvider
      contentId={contentId}
      currentUserId={data.currentUserId}
      initialComments={data.comments}
      initialLastReadAt={data.lastReadAt}
    >
      <AutoOpenInbox onClose={onClose} />
    </CommentsProvider>
  );
}

/** Ouvre directement l'inbox (pas de "thread" précis pertinent ici). */
function AutoOpenInbox({ onClose }: { onClose: () => void }) {
  const { openThread, drawer } = useComments();

  // Va directement sur le thread "plan/general" (la discussion générale du
  // contenu) plutôt que sur l'inbox : l'inbox liste des threads existants
  // mais n'a PAS de zone pour écrire — sans ça, un contenu sans commentaire
  // encore ouvrait un écran vide sans aucun moyen d'en poster un premier.
  React.useEffect(() => {
    openThread("plan", "general");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!drawer.open) onClose();
  }, [drawer.open, onClose]);

  return <CommentsDrawer targetLabels={{}} />;
}
