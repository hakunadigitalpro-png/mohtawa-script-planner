/**
 * `media` = un visuel de carrousel / post / infographie. C'est la même
 * logique que `scene` (une scène de storyboard) et `slide` (un slot de
 * story), étendue aux formats non-vidéo : un fil de discussion ancré sur
 * l'image dont on parle, et pas sur le contenu en bloc.
 */
export type CommentTargetType =
  | "plan"
  | "script"
  | "scene"
  | "slide"
  | "media";

export type Comment = {
  id: string;
  content_id: string;
  target_type: CommentTargetType;
  target_id: string;
  parent_id: string | null;
  /** Null pour les commentaires invités (laissés via le lien public partagé). */
  user_id: string | null;
  /** Null pour les invités — leur identité est dans guest_name. */
  author_email: string | null;
  /** Présent uniquement pour les commentaires invités (migration 0012). */
  guest_name: string | null;
  /** Email invité (optionnel à la saisie). Pas exposé sur la page publique. */
  guest_email: string | null;
  /** True si le commentaire vient d'un invité (user_id is null). */
  is_guest: boolean;
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
