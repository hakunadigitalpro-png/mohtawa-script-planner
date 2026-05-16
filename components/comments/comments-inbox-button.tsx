"use client";

import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useComments } from "./comments-provider";

/**
 * Bouton à placer dans le header de la fiche vidéo : ouvre la sidebar
 * inbox globale et montre un badge rouge si des commentaires sont non lus.
 */
export function CommentsInboxButton() {
  const { unreadCount, openInbox } = useComments();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openInbox(unreadCount > 0 ? "unread" : "all")}
      className="relative"
    >
      <MessageSquare className="size-3.5" />
      Commentaires
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
}
