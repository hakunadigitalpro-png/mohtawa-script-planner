"use client";

import { MessageSquare, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComments } from "./comments-provider";
import type { CommentTargetType } from "./types";

/**
 * Bouton "💬" à coller sur chaque item commentable.
 *
 * - Si aucun commentaire : icône muette
 * - Si commentaires existants : badge avec le total
 * - Si non lus : badge orange (accent)
 * - Si thread racine résolu : icône check verte discrète
 */
export function CommentButton({
  targetType,
  targetId,
  size = "sm",
  className,
  ariaLabel,
}: {
  targetType: CommentTargetType;
  targetId: string;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  const { openThread, countFor } = useComments();
  const { total, unread, resolved } = countFor(targetType, targetId);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openThread(targetType, targetId);
  };

  const hasComments = total > 0;
  const hasUnread = unread > 0;

  const sizeClasses = size === "sm"
    ? "h-7 gap-1 px-2 text-xs"
    : "h-8 gap-1.5 px-2.5 text-sm";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? "Voir les commentaires"}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        sizeClasses,
        hasUnread
          ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
          : hasComments
          ? "border-border/60 bg-card text-foreground hover:bg-secondary"
          : "border-transparent bg-transparent text-muted hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      <MessageSquare className={size === "sm" ? "size-3" : "size-3.5"} />
      {hasComments && (
        <span className="font-semibold">{total}</span>
      )}
      {resolved && total > 0 && (
        <Check className={cn(
          size === "sm" ? "size-3" : "size-3.5",
          "text-emerald-600",
        )} />
      )}
    </button>
  );
}
