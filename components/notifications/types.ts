/**
 * Représente une notification telle que retournée par la RPC
 * `list_my_notifications`. Voir migration 0013.
 */
export type Notification = {
  id: string;
  content_id: string | null;
  comment_id: string | null;
  type: "comment" | "ready_to_schedule";
  read: boolean;
  created_at: string;
  content_title: string | null;
  comment_target_type: "plan" | "script" | "scene" | "slide" | null;
  comment_target_id: string | null;
  comment_body: string | null;
  guest_name: string | null;
  author_email: string | null;
  is_guest: boolean;
};
