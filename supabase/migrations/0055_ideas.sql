-- =====================================================================
-- 0055 — Les idées : un contenu avant qu'il ait une date et un format
-- Idempotent. À exécuter dans le SQL Editor de Supabase.
--
-- Une idée n'est pas un nouvel objet : c'est un `contents` qui n'a pas
-- encore de date. Le modèle le permettait déjà (`date` nullable, `status`
-- par défaut 'idea') — il manquait deux choses.
-- =====================================================================

-- =====================================================================
-- 1) Un contenu peut naître sans format
--
-- En atelier, on se met d'accord sur une idée avant de savoir si ce sera
-- un reel ou un carrousel. Le format était obligatoire, donc il fallait
-- trancher au moment où l'on note — exactement l'inverse de l'usage.
--
-- `contents_type_check` n'a PAS besoin d'être retouchée : en SQL, une
-- contrainte CHECK dont l'expression vaut NULL est satisfaite. On la
-- réécrit quand même, pour que la lecture du schéma dise explicitement
-- qu'un format absent est permis plutôt que de laisser croire à un oubli.
-- =====================================================================

alter table public.contents
  alter column type drop not null;

alter table public.contents
  drop constraint if exists contents_type_check;

alter table public.contents
  add constraint contents_type_check
  check (
    type is null
    or type in ('reel', 'story', 'vlog', 'post', 'carousel', 'infographic')
  );

-- =====================================================================
-- 2) Le statut « Retenue »
--
-- Entre « notée » et « en écriture », il manquait le moment de l'atelier :
-- l'idée est validée ensemble, mais rien n'est encore écrit et le format
-- n'est pas forcément décidé.
--
-- Ajouté au vocabulaire COMMUN (vidéos et formats simples), comme 'idea',
-- 'approved' et 'live' : une idée n'a pas de format, elle ne peut donc pas
-- hériter d'un vocabulaire propre à l'un ou à l'autre.
--
-- La vue client n'a rien à changer : `clientStatusLabel` ne connaît pas
-- cette valeur et retombe sur « En préparation », ce qui est exact.
-- =====================================================================

alter table public.contents
  drop constraint if exists contents_status_check;

alter table public.contents
  add constraint contents_status_check
  check (status in (
    'idea', 'selected',
    'script', 'filming', 'editing', 'scheduled', 'published',
    'design', 'pending_review', 'needs_revision', 'approved', 'programmed', 'live'
  ));

-- Les idées se lisent par marque, filtrées sur l'absence de date : c'est la
-- requête de l'onglet, elle mérite son index.
create index if not exists contents_brand_undated_idx
  on public.contents(brand_id, status)
  where date is null;

-- =====================================================================
-- 3) `notes` : ce que dit l'idée, avant de savoir où l'écrire
--
-- Sans format, le texte développé d'une idée n'avait AUCUNE colonne où
-- aller : `reel_details.script_full` et `vlog_details.voiceover` supposent
-- une vidéo, `contents.caption` un post. Un atelier qui produit vingt
-- angles détaillés les aurait donc perdus à l'import.
--
-- `notes` porte cet entre-deux : l'angle, les points à couvrir, le ton.
-- Au moment où le format est choisi, l'application recopie ce texte dans
-- le champ qui lui correspond, si celui-ci est encore vide.
-- =====================================================================

alter table public.contents
  add column if not exists notes text;
