export type Brand = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type BrandMember = {
  brand_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
};

export type Content = {
  id: string;
  brand_id: string;
  user_id: string;
  type: string;
  title: string | null;
  date: string | null;
  platform: string | null;
  status: string;
  pillar: string | null;
  objective: string | null;
  hook: string | null;
  cta: string | null;
  tags: string[] | null;
  share_token: string | null;
  /** 'read' = lien public en lecture seule, 'comment' = invités peuvent commenter. */
  share_mode: "read" | "comment";
  /**
   * Auto-progression du statut activée (0015). Tant que true, le statut
   * avance automatiquement quand l'utilisateur coche script_ready, marque
   * des scènes filmed, etc. Bascule à false dès que l'user change le statut
   * manuellement dans le Plan.
   */
  auto_status: boolean;
  created_at: string;
  updated_at: string;
};

export type ReelDetails = {
  content_id: string;
  message_key: string | null;
  intro: string | null;
  point1: string | null;
  point2: string | null;
  point3: string | null;
  transition: string | null;
  recap: string | null;
  outro: string | null;
  script_full: string | null;
  checklist: {
    script_ready?: boolean;
    scenes_ready?: boolean;
    filmed?: boolean;
    edited?: boolean;
    published?: boolean;
  } | null;
};

export type StoryDetails = {
  content_id: string;
  objective: string | null;
  cta_soft: string | null;
  format: string | null;
};

export type StorySlide = {
  id: string;
  content_id: string;
  slot_number: number;
  body: string | null;
  image_url: string | null;
  /** Marqué filmé par l'utilisateur (migration 0010). Indépendant de la checklist macro. */
  filmed: boolean;
};

export type StoryboardScene = {
  id: string;
  content_id: string;
  scene_number: number;
  description: string | null;
  camera_angle: string | null;
  on_screen_text: string | null;
  tag: string | null;
  image_url: string | null;
  /** Marquée filmée par l'utilisateur (migration 0010). Indépendant de la checklist macro. */
  filmed: boolean;
};

export type ChecklistItemCategory = "equipment" | "preparation";

export type ChecklistItem = {
  id: string;
  content_id: string;
  category: ChecklistItemCategory;
  label: string;
  position: number;
  done: boolean;
  created_at: string;
};

export type Performance = {
  content_id: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  retention: number | null;
  notes: string | null;
  updated_at: string;
};
