"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { Comment, CommentTargetType } from "./types";

type DrawerState =
  | { open: false }
  | { open: true; mode: "thread"; targetType: CommentTargetType; targetId: string }
  | { open: true; mode: "inbox"; filter: "all" | "unread" | "resolved" };

type Ctx = {
  contentId: string;
  currentUserId: string;
  comments: Comment[];
  refresh: () => Promise<void>;
  lastReadAt: string;
  // Drawer state (panneau de commentaires global)
  drawer: DrawerState;
  openThread: (targetType: CommentTargetType, targetId: string) => void;
  openInbox: (filter?: "all" | "unread" | "resolved") => void;
  closeDrawer: () => void;
  // Helpers de comptage
  unreadCount: number;
  countFor: (targetType: CommentTargetType, targetId: string) => {
    total: number;
    unread: number;
    resolved: boolean;
  };
  // Mémoire utilisateur (déjà lus localement)
  markTargetSeen: (targetType: CommentTargetType, targetId: string) => void;
};

const CommentsContext = React.createContext<Ctx | null>(null);

export function CommentsProvider({
  contentId,
  currentUserId,
  initialComments,
  initialLastReadAt,
  children,
}: {
  contentId: string;
  currentUserId: string;
  initialComments: Comment[];
  initialLastReadAt: string;
  children: React.ReactNode;
}) {
  const [comments, setComments] = React.useState<Comment[]>(initialComments);
  const [lastReadAt] = React.useState(initialLastReadAt);
  const [drawer, setDrawer] = React.useState<DrawerState>({ open: false });

  const supabase = React.useMemo(() => createClient(), []);

  const refresh = React.useCallback(async () => {
    const { data } = await supabase.rpc("list_content_comments_with_authors", {
      p_content_id: contentId,
    });
    if (data) setComments(data as Comment[]);
  }, [contentId, supabase]);

  const openThread = React.useCallback(
    (targetType: CommentTargetType, targetId: string) => {
      setDrawer({ open: true, mode: "thread", targetType, targetId });
    },
    [],
  );

  const openInbox = React.useCallback(
    (filter: "all" | "unread" | "resolved" = "all") => {
      setDrawer({ open: true, mode: "inbox", filter });
    },
    [],
  );

  const closeDrawer = React.useCallback(() => {
    setDrawer({ open: false });
  }, []);

  // Compteurs : on calcule en mémo sur l'array `comments`.
  const counters = React.useMemo(() => {
    const byTarget = new Map<
      string,
      { total: number; unread: number; resolved: boolean; rootCreatedAt: string }
    >();

    for (const c of comments) {
      const key = `${c.target_type}:${c.target_id}`;
      const prev = byTarget.get(key);
      const isUnread =
        c.user_id !== currentUserId && c.created_at > lastReadAt;

      // Le `resolved` est porté par le commentaire racine du thread
      const isRoot = c.parent_id === null;

      if (!prev) {
        byTarget.set(key, {
          total: 1,
          unread: isUnread ? 1 : 0,
          resolved: isRoot ? c.resolved : false,
          rootCreatedAt: c.created_at,
        });
      } else {
        prev.total += 1;
        if (isUnread) prev.unread += 1;
        if (isRoot) prev.resolved = c.resolved;
        if (c.created_at < prev.rootCreatedAt) prev.rootCreatedAt = c.created_at;
      }
    }

    return byTarget;
  }, [comments, currentUserId, lastReadAt]);

  const countFor = React.useCallback(
    (targetType: CommentTargetType, targetId: string) => {
      const v = counters.get(`${targetType}:${targetId}`);
      return v
        ? { total: v.total, unread: v.unread, resolved: v.resolved }
        : { total: 0, unread: 0, resolved: false };
    },
    [counters],
  );

  const unreadCount = React.useMemo(() => {
    let total = 0;
    for (const c of comments) {
      if (c.user_id !== currentUserId && c.created_at > lastReadAt) {
        total += 1;
      }
    }
    return total;
  }, [comments, currentUserId, lastReadAt]);

  // markTargetSeen : pour l'instant on ne le persiste pas côté DB par item
  // (on a seulement un read global par content). On garde l'API au cas où on
  // veut implémenter plus tard une read map per-target.
  const markTargetSeen = React.useCallback(() => {
    // no-op pour l'instant
  }, []);

  const value: Ctx = {
    contentId,
    currentUserId,
    comments,
    refresh,
    lastReadAt,
    drawer,
    openThread,
    openInbox,
    closeDrawer,
    unreadCount,
    countFor,
    markTargetSeen,
  };

  return (
    <CommentsContext.Provider value={value}>
      {children}
    </CommentsContext.Provider>
  );
}

export function useComments(): Ctx {
  const ctx = React.useContext(CommentsContext);
  if (!ctx) {
    throw new Error("useComments must be used within <CommentsProvider>");
  }
  return ctx;
}
