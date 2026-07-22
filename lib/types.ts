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

/**
 * Pilier de contenu enrichi (migration 0028). Au-delà du nom, il porte la
 * structure d'une stratégie : objectif, rubriques récurrentes, exemples de
 * vidéos, une note (le pourquoi) et la part visée dans le mix (%).
 */
export type BrandPillar = {
  id: string;
  name: string;
  objective: string | null;
  rubriques: string[];
  examples: string[];
  note: string | null;
  share_pct: number | null;
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
  /** Pilier "primaire" : auto-synchronisé sur pillars[0] via trigger (migration 0018). */
  pillar: string | null;
  /** Objectif "primaire" : auto-synchronisé sur objectives[0] via trigger (migration 0018). */
  objective: string | null;
  /** Tous les piliers liés à cette vidéo (multi-sélection, migration 0018). */
  pillars: string[];
  /** Tous les objectifs liés à cette vidéo (multi-sélection, migration 0018). */
  objectives: string[];
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
  /**
   * URL de la vidéo publiée sur la plateforme (Instagram, TikTok, etc.).
   * Saisi par l'utilisateur dans l'onglet Performance après publication.
   * Migration 0017.
   */
  video_url: string | null;
  /**
   * Texte qui accompagne la vidéo lors de la publication (hashtags,
   * mention, contexte). Migration 0019. Géré dans son propre onglet
   * "Caption" entre Checklist et Performance.
   */
  caption: string | null;
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

/**
 * Détails d'un Vlog (migration 0027). Un vlog ne se planifie pas scène par
 * scène : angle narratif + hook d'ouverture + arc en 3 temps + voix-off.
 * Les moments à filmer vivent dans content_checklist_items (catégorie
 * 'capture'), pas ici.
 */
export type VlogDetails = {
  content_id: string;
  angle: string | null;
  hook: string | null;
  arc_situation: string | null;
  arc_development: string | null;
  arc_payoff: string | null;
  voiceover: string | null;
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
  /** Notes de montage / post-prod (migration 0016) : filtres, effets, transitions, son. */
  editing_notes: string | null;
};

/**
 * Une publication sur une plateforme spécifique (Instagram, TikTok, YT…).
 * Plusieurs publications par vidéo possible. Migration 0020.
 */
export type ContentPublication = {
  id: string;
  content_id: string;
  platform: string;
  scheduled_date: string | null;
  url: string | null;
  created_at: string;
};

/**
 * Setup de tournage réutilisable, scoped par marque (Storyboard Lot 2,
 * migration 0021). Inséré en 1 clic dans le storyboard pour pré-remplir
 * une scène (image de réf + cadrage + notes montage). Seul `label` est
 * obligatoire.
 */
export type ScenePreset = {
  id: string;
  brand_id: string;
  label: string;
  reference_image_url: string | null;
  default_camera: string | null;
  default_editing_notes: string | null;
  position: number;
  created_at: string;
};

export type ChecklistItemCategory = "equipment" | "preparation" | "capture";

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
  /** Transcript de la vidéo (collé par l'user). Autopsie IA — migration 0022. */
  transcript: string | null;
  /** Notes de rétention ("drop vers 15s"). Autopsie IA — migration 0022. */
  retention_notes: string | null;
  /** Résultat de l'autopsie IA (texte formaté). Migration 0022. */
  autopsy_md: string | null;
  /** Date de génération de l'autopsie. Migration 0022. */
  autopsy_at: string | null;
  /** Capture unique (legacy 0023, remplacé par insights_image_urls). */
  insights_image_url: string | null;
  /** Captures d'écran des insights (Claude les lit). Migration 0024. */
  insights_image_urls: string[];
  /** Legacy 0023 — non utilisé par l'UI. */
  avg_watch_seconds: number | null;
  /** Legacy 0023 — non utilisé par l'UI. */
  video_duration_seconds: number | null;
  /** Legacy 0023 — non utilisé par l'UI. */
  performance_label: string | null;
  updated_at: string;
};
