export type Brand = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  /** Logo de la marque (brand_kits.logo_url), embarqué par listUserBrands —
   *  affiché à la place de l'initiale. Null tant qu'aucun logo n'est posé. */
  logo_url?: string | null;
};

export type BrandMember = {
  brand_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
};

/**
 * Brand Kit — identité de marque personnalisable (migration 0031). L'audience
 * et la voix nourrissent aussi les générations IA (ton + cible).
 */
export type BrandKit = {
  brand_id: string;
  logo_url: string | null;
  // Les 3 colonnes de couleurs (color_primary/secondary/accent) existent
  // toujours en base mais ne sont plus exposées ni demandées : rien ne les
  // consommait — pas de génération d'image, pas d'affichage, pas d'export.
  tagline: string | null;
  audience: string | null;
  voice: string | null;
  hashtags: string[];
};

/**
 * Stratégie générée par le Studio de marque (migration 0039) : le
 * positionnement, l'audience et la voix reformulés, les galères de
 * l'audience, la méthode, et des messages clés à répéter. Volontairement
 * SANS thèmes de contenu — ça reste le rôle de l'assistant de thèmes
 * existant (PillarManager / ThemeAssistant), pour ne pas dupliquer la même
 * capacité à deux endroits.
 */
/**
 * Une cible de la marque. Beaucoup d'activités en ont deux ou trois qui n'ont
 * rien à voir — un restaurant vise les familles le midi ET les entreprises
 * pour leurs événements. Les écraser en un seul portrait produit une
 * stratégie tiède qui ne parle bien à personne.
 */
export type StrategyAudience = {
  /** Nom court et parlant : « Les familles du quartier ». */
  name: string;
  /** Qui c'est, en une phrase. */
  who: string;
  /** Ce qu'elle cherche, en une phrase. */
  wants: string;
  /** Ses galères à ELLE — c'est là que la séparation compte vraiment. */
  pain_points: string[];
};

export type GeneratedStrategy = {
  positioning: string;
  tagline: string;
  /** 1 à 3 cibles détectées. Absent sur les stratégies générées avant 08/2026. */
  audiences?: StrategyAudience[];
  /** Résumé de la cible PRINCIPALE — dérivé de `audiences[0]`, conservé pour
   *  que les stratégies déjà générées continuent de s'afficher. */
  audience_summary: string;
  voice_summary: string;
  pain_points: string[];
  approach: string;
  key_messages: string[];
  /** Hashtags récurrents de la marque — déduits du positionnement et de
   *  l'audience, jamais saisis à la main. Réutilisés dans les légendes. */
  hashtags: string[];
};

/**
 * Réponses + résultat du Studio de marque (migration 0039). `answers` est
 * un brouillon (autosave, permet de reprendre le questionnaire plus tard).
 * `generated` reste null tant que l'IA n'a pas encore produit de stratégie.
 */
export type BrandStrategy = {
  brand_id: string;
  answers: Record<string, string>;
  generated: GeneratedStrategy | null;
  generated_at: string | null;
  updated_at: string;
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
  /** Mode d'écriture (migration 0030) : false = guidé (Accroche/Corps/Outro),
   *  true = libre (un seul bloc = script_full). */
  script_free_mode: boolean;
  checklist: {
    script_ready?: boolean;
    scenes_ready?: boolean;
    filmed?: boolean;
    edited?: boolean;
    published?: boolean;
  } | null;
  /** Résumé de tournage généré par l'IA (migration 0047), en même temps que
   *  le storyboard — éclairage, style caméra, rythme, énergie, conseil pro.
   *  Éditable ensuite comme le reste. */
  filming_guide: FilmingGuide | null;
};

export type EquipmentPosition =
  | "face"
  | "avant_droite"
  | "droite"
  | "arriere_droite"
  | "arriere"
  | "arriere_gauche"
  | "gauche"
  | "avant_gauche";

export type EquipmentPlacement = {
  label: string;
  position: EquipmentPosition;
  note: string;
};

/** Placement du matériel d'UN setup précis, vu du dessus (0051) — un
 *  storyboard qui mélange plusieurs lieux a un layout par lieu utilisé,
 *  pas un seul global (le matériel dépend du lieu, pas de la marque). */
export type PresetEquipmentLayout = {
  /** Reprend le label exact du setup (brand_scene_presets.label). */
  preset_label: string;
  equipment_layout: EquipmentPlacement[];
};

export type FilmingGuide = {
  lighting: string;
  camera_style: string;
  pacing: string;
  energy: string;
  tip: string;
  /** Où poser le téléphone/la caméra, vu du dessus — toujours demandé (pas
   *  besoin de matériel configuré pour savoir où filmer depuis). */
  camera_position?: EquipmentPosition;
  /** Un layout par setup RÉELLEMENT utilisé dans ce storyboard et qui a du
   *  matériel renseigné (0051) — absent si aucun setup équipé n'est utilisé. */
  preset_layouts?: PresetEquipmentLayout[];
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

/**
 * Visuel ordonné d'un contenu non-vidéo (post/carrousel/infographie).
 * Migration 0038. Un post/infographie = 1 ligne, un carrousel = N lignes.
 */
export type ContentMedia = {
  id: string;
  content_id: string;
  position: number;
  image_url: string | null;
  created_at: string;
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
  /** Direction de jeu, courte (migration 0047) : "Souriant, regard caméra". */
  expression: string | null;
  /** Gestuelle / mouvement, courte (migration 0047) : "Main sur le cœur, hoche la tête". */
  movement: string | null;
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
  /** Heure de publication (HH:MM:SS), par plateforme. Migration 0040. */
  scheduled_time: string | null;
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
  /** Matériel dispo à CE lieu précis (0051) — un setup "face fenêtre" n'a
   *  souvent aucun matériel, un setup "bureau" peut en avoir plusieurs. */
  equipment: string | null;
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

/**
 * Tâche d'équipe (board Kanban "/tasks", migration 0049 — remplace le
 * bloc-notes perso `personal_tasks` de la migration 0048) : visible par
 * toute l'équipe de la marque (`brand_id`), assignable à un membre
 * (`assignee_id`), avec un statut à 3 colonnes façon Trello. `brand_id`
 * reste nullable pour les rares tâches créées avant ce changement sans
 * marque associée — elles restent visibles seulement par leur créatrice
 * (voir policy RLS `tasks_select`). `content_id`/`content_title` optionnels :
 * renseignés quand la tâche vient d'une notification, pour rebondir vers
 * la vidéo concernée.
 */
export type TaskPriority = "urgent" | "normal";
export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  user_id: string;
  brand_id: string | null;
  assignee_id: string | null;
  content_id: string | null;
  content_title: string | null;
  label: string;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  done_at: string | null;
};
