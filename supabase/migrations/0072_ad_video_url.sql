-- Chaque ad (et chaque diapo d'un carrousel) peut porter un lien vidéo
-- en plus de son visuel statique : YouTube, Vimeo, Drive. L'éditeur
-- montre une petite prévisualisation à la place du visuel quand le lien
-- est rempli. Les deux restent utiles : le visuel sert si la lecture
-- vidéo est bloquée, ou pour pré-visualiser rapidement.
--
-- Idempotent : add column if not exists.

alter table public.ads
  add column if not exists video_url text;

alter table public.ad_slides
  add column if not exists video_url text;

comment on column public.ads.video_url is
  'Lien externe (Drive, YouTube, Vimeo) vers la vidéo de l''ad. Prime sur visual_url quand rempli.';
comment on column public.ad_slides.video_url is
  'Lien externe (Drive, YouTube, Vimeo) vers la vidéo de la diapo. Prime sur visual_url quand rempli.';
