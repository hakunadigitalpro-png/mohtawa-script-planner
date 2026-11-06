-- Reprise de données, demandée par Mariam le 06/11/2026 : les contenus qui ont un
-- format mais sont restés en « Idée » passent à leur étape d'écriture, comme le
-- fait désormais la création (`initialStatus`). Script pour une vidéo, Design
-- pour un post, un carrousel ou une infographie.
--
-- Rien d'autre ne change. Chaque passage est noté dans l'historique au nom de
-- Kreatly, et le menu Statut permet de revenir en arrière contenu par contenu.
-- Le serveur fait une sauvegarde complète de la base avant d'appliquer.

select set_config('kreatly.system_change', '1', true);

update public.contents
set status = case
  when type in ('post', 'carousel', 'infographic') then 'design'
  else 'script'
end
where type is not null
  and status in ('idea', 'selected');

select set_config('kreatly.system_change', '', true);
