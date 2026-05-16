export type CommentTargetType = "plan" | "script" | "scene" | "slide";

export type Comment = {
  id: string;
  content_id: string;
  target_type: CommentTargetType;
  target_id: string;
  parent_id: string | null;
  user_id: string;
  author_email: string;
  body: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
};

export type CommentTarget = {
  type: CommentTargetType;
  id: string;
  /** Label affiché dans l'inbox globale, ex: "Plan 03", "Story 1", "Hook" */
  label: string;
};
