-- =====================================================================
-- Seed ADDITIF — Remplit la marque "MBS" (compte de démo client) avec
-- beaucoup de contenu réaliste, pour que le calendrier, le dashboard et
-- les analytics aient l'air d'un compte vraiment actif.
--
-- DIFFÉRENCE avec seed_test_brand.sql : ce script n'est PAS une marque
-- jetable qu'on recrée à chaque fois — "MBS" est une marque existante,
-- avec du contenu réel dedans. Ce script AJOUTE du contenu, il ne
-- supprime et ne touche RIEN à ce qui existe déjà.
--
-- Sécurité anti-double-exécution : si le contenu-sentinelle (le tout
-- premier titre inséré) existe déjà sur "MBS", le script s'arrête sans
-- rien insérer de plus (pour éviter les doublons si tu le relances).
--
-- ~41 contenus ajoutés :
--  - 20 déjà publiés/live (8 dernières semaines) avec vues/likes/etc.
--    → remplit Analytics (classement piliers, tendance, top vidéos)
--  - 17 à venir (prochaines ~4 semaines), tous types/statuts mélangés
--    → remplit le Calendrier + le bloc "Prochainement" du Dashboard
--  - 4 idées en attente sans date (backlog normal, jamais signalé)
--
-- À exécuter une fois dans le SQL Editor Supabase.
-- =====================================================================

do $$
declare
  v_user_id   uuid;
  v_brand_id  uuid;
  p1 text; p2 text; p3 text; p4 text;
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid; v_c5 uuid;
  v_c6 uuid; v_c7 uuid; v_c8 uuid; v_c9 uuid; v_c10 uuid;
  v_c11 uuid; v_c12 uuid; v_c13 uuid; v_c14 uuid; v_c15 uuid;
  v_c16 uuid; v_c17 uuid; v_c18 uuid; v_c19 uuid; v_c20 uuid;
  v_c21 uuid; v_c22 uuid; v_c23 uuid; v_c24 uuid; v_c25 uuid;
  v_c26 uuid; v_c27 uuid; v_c28 uuid; v_c29 uuid; v_c30 uuid;
  v_c31 uuid; v_c32 uuid; v_c33 uuid; v_c34 uuid; v_c35 uuid;
  v_c36 uuid; v_c37 uuid; v_c38 uuid; v_c39 uuid; v_c40 uuid;
  v_c41 uuid;
  v_today date := current_date;
begin
  select id into v_user_id from auth.users where email = 'hakuna.digitalpro@gmail.com';
  if v_user_id is null then
    raise exception 'Compte hakuna.digitalpro@gmail.com introuvable — adapte l''email en haut du script.';
  end if;

  select id into v_brand_id from public.brands where name ilike 'MBS' limit 1;
  if v_brand_id is null then
    raise exception 'Marque "MBS" introuvable. Marques disponibles pour ce compte : %',
      (select string_agg(b.name, ', ') from public.brands b
       join public.brand_members m on m.brand_id = b.id
       where m.user_id = v_user_id);
  end if;

  if exists (
    select 1 from public.contents
    where brand_id = v_brand_id
      and title = 'Le secret pour ne jamais manquer d''idées de contenu'
  ) then
    raise notice 'Déjà seedé sur MBS — script ignoré (pas de doublon créé).';
    return;
  end if;

  -- Piliers : réutilise ceux déjà en place sur MBS, sinon en crée 4 --------
  select name into p1 from public.brand_pillars where brand_id = v_brand_id order by position limit 1 offset 0;
  select name into p2 from public.brand_pillars where brand_id = v_brand_id order by position limit 1 offset 1;
  select name into p3 from public.brand_pillars where brand_id = v_brand_id order by position limit 1 offset 2;
  select name into p4 from public.brand_pillars where brand_id = v_brand_id order by position limit 1 offset 3;

  if p1 is null then
    insert into public.brand_pillars (brand_id, name, position, objective, note, share_pct) values
      (v_brand_id, 'Conseils contenu', 1, 'Attirer en montrant l''expertise', 'Le pilier qui convertit le mieux', 40)
    returning name into p1;
  end if;
  if p2 is null then
    insert into public.brand_pillars (brand_id, name, position, objective, note, share_pct) values
      (v_brand_id, 'Témoignages clients', 2, 'Rassurer, construire la confiance', 'Preuve sociale', 25)
    returning name into p2;
  end if;
  if p3 is null then
    insert into public.brand_pillars (brand_id, name, position, objective, note, share_pct) values
      (v_brand_id, 'Coulisses', 3, 'Créer du lien, montrer l''humain', 'Humanise la marque', 25)
    returning name into p3;
  end if;
  if p4 is null then
    insert into public.brand_pillars (brand_id, name, position, objective, note, share_pct) values
      (v_brand_id, 'Astuces rapides', 4, 'Engager, contenu léger à produire', 'Facile à produire en volume', 10)
    returning name into p4;
  end if;

  -- =====================================================================
  -- 1) DÉJÀ PUBLIÉS / LIVE (8 dernières semaines) — avec performances -----
  -- =====================================================================

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Le secret pour ne jamais manquer d''idées de contenu', v_today - 54, 'instagram', 'published', p1, array[p1])
  returning id into v_c1;
  insert into public.reel_details (content_id, intro, point1, point2, point3, outro, script_full)
  values (v_c1, 'Tu galères à trouver quoi poster ?', 'Note 3 idées chaque dimanche.', 'Recycle un ancien contenu qui a marché.', 'Réponds aux questions reçues en DM.', 'Sauvegarde pour ne pas oublier !', null);
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c1, 1400, 110, 18, 25, 60);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', '5 erreurs qui tuent ton engagement', v_today - 50, 'linkedin', 'live', p1, array[p1], '5 erreurs que je vois tout le temps — et comment les corriger.')
  returning id into v_c2;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c2, 2100, 160, 22, 30, 85);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'story', 'Behind the scenes tournage studio', v_today - 47, 'tiktok', 'published', p3, array[p3])
  returning id into v_c3;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c3, 500, 40, 5, 3, 10);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'On a dépassé un nouveau cap, merci à vous !', v_today - 45, 'facebook', 'live', p2, array[p2], 'Merci à toute la communauté pour ce cap franchi ensemble 🙏')
  returning id into v_c4;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c4, 800, 55, 9, 6, 20);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'vlog', 'Une semaine dans la vie d''une entrepreneuse', v_today - 42, 'youtube', 'published', p3, array[p3])
  returning id into v_c5;
  insert into public.vlog_details (content_id, angle, hook, arc_situation, arc_development, arc_payoff, voiceover)
  values (v_c5, 'Une semaine complète, sans filtre', 'Lundi 6h, ça commence déjà...', 'Les rendez-vous clients s''enchaînent.', 'Un imprévu à gérer en plein milieu.', 'Vendredi soir : bilan de la semaine.', 'Voici à quoi ressemble vraiment ma semaine...');
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c5, 3200, 240, 35, 40, 90);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'infographic', 'Les 3 piliers d''une stratégie de contenu', v_today - 40, 'linkedin', 'live', p1, array[p1], 'Simple à retenir, simple à appliquer.')
  returning id into v_c6;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c6, 950, 70, 10, 8, 25);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Pourquoi ton contenu ne convertit pas', v_today - 38, 'instagram', 'published', p1, array[p1])
  returning id into v_c7;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c7, 1800, 140, 20, 28, 70);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', 'Avant / Après : le feed d''une cliente', v_today - 35, 'instagram', 'live', p2, array[p2], 'Le même compte, 2 mois d''écart. La différence parle d''elle-même.')
  returning id into v_c8;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c8, 2600, 190, 28, 35, 95);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'story', 'Sondage : quel format tu préfères ?', v_today - 33, 'instagram', 'published', p4, array[p4])
  returning id into v_c9;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c9, 500, 35, 4, 2, 8);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'Nouvelle collaboration à découvrir', v_today - 30, 'instagram', 'live', p3, array[p3], 'On a préparé quelque chose de spécial avec une marque qu''on adore.')
  returning id into v_c10;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c10, 1100, 80, 12, 9, 30);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Comment j''organise mon mois de contenu', v_today - 5, 'tiktok', 'published', p1, array[p1])
  returning id into v_c11;
  insert into public.reel_details (content_id, intro, point1, point2, point3, outro, script_full)
  values (v_c11, 'Voici mon système complet, en 3 étapes.', 'Étape 1 : brainstorm du dimanche.', 'Étape 2 : je planifie tout le mois.', 'Étape 3 : je tourne en une seule journée (batch).', 'Tu veux le template ? Dis-le en commentaire.', null);
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c11, 4200, 310, 45, 55, 140);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'vlog', 'Coulisses d''un shooting photo', v_today - 24, 'instagram', 'published', p3, array[p3])
  returning id into v_c12;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c12, 2000, 150, 22, 25, 60);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', '3 templates de légende qui marchent', v_today - 4, 'linkedin', 'live', p1, array[p1], 'Copie-colle, adapte à ta marque, publie.')
  returning id into v_c13;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c13, 1300, 95, 14, 16, 45);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'infographic', 'Le calendrier éditorial idéal', v_today - 18, 'facebook', 'live', p1, array[p1], 'À imprimer et à garder sous les yeux.')
  returning id into v_c14;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c14, 700, 50, 7, 5, 18);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'Merci pour vos retours sur le dernier post', v_today - 15, 'facebook', 'live', p2, array[p2], 'On lit tous vos commentaires — merci pour l''énergie !')
  returning id into v_c15;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c15, 600, 42, 6, 4, 15);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Le format qui a explosé ce mois-ci', v_today - 12, 'instagram', 'published', p1, array[p1])
  returning id into v_c16;
  insert into public.reel_details (content_id, intro, point1, point2, point3, outro, script_full)
  values (v_c16, 'Un seul format a tout changé pour moi.', 'Je filme en 1 prise, sans montage complexe.', 'Un texte à l''écran, pas de voix-off.', 'Une question ouverte à la fin.', 'Teste-le cette semaine, dis-moi le résultat.', null);
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c16, 5100, 380, 58, 70, 180);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'story', 'Questions/réponses avec la communauté', v_today - 9, 'tiktok', 'published', p4, array[p4])
  returning id into v_c17;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c17, 400, 30, 3, 2, 7);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', 'Le contenu qui a le mieux marché cette semaine', v_today - 3, 'instagram', 'live', p1, array[p1], 'On décortique pourquoi celui-là a fonctionné.')
  returning id into v_c18;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c18, 1900, 140, 20, 24, 65);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Astuce rapide : 3 accroches qui marchent', v_today - 2, 'tiktok', 'published', p4, array[p4])
  returning id into v_c19;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c19, 2400, 180, 26, 32, 80);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'On lance une nouveauté bientôt', v_today - 1, 'instagram', 'live', p3, array[p3], 'Un petit indice aujourd''hui, la suite très vite 👀')
  returning id into v_c20;
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c20, 1600, 115, 17, 14, 48);

  -- =====================================================================
  -- 2) À VENIR (prochaines ~4 semaines) — calendrier bien rempli ---------
  -- =====================================================================

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'story', 'Un jour dans mon quotidien', v_today + 1, 'instagram', 'script', p3, array[p3])
  returning id into v_c21;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c21, 'instagram', v_today + 1);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Comment gérer les commentaires négatifs', v_today + 2, 'instagram', 'filming', p1, array[p1])
  returning id into v_c22;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c22, 'instagram', v_today + 2);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', '5 outils gratuits pour créer du contenu', v_today + 3, 'linkedin', 'pending_review', p1, array[p1], 'Ma boîte à outils complète, testée et approuvée.')
  returning id into v_c23;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c23, 'linkedin', v_today + 3);
  insert into public.content_comments (content_id, target_type, target_id, user_id, guest_name, body)
  values (v_c23, 'plan', 'general', null, 'Client (démo)', 'Top, on peut ajouter Canva à la liste ?');

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'Question du jour à la communauté', v_today + 4, 'facebook', 'approved', p2, array[p2], 'Dites-nous en commentaire : votre plus gros blocage en création de contenu ?')
  returning id into v_c24;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c24, 'facebook', v_today + 4);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'infographic', 'Les chiffres à retenir cette semaine', v_today + 5, 'instagram', 'design', p1, array[p1], null)
  returning id into v_c25;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c25, 'instagram', v_today + 5);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'vlog', 'Une journée de tournage complète', v_today + 6, 'youtube', 'editing', p3, array[p3])
  returning id into v_c26;
  insert into public.vlog_details (content_id, angle, hook, arc_situation, arc_development, arc_payoff)
  values (v_c26, 'Une journée de tournage, du setup au rangement', 'Aujourd''hui je vous montre tout, même les ratés.', 'Le matin : préparation du matériel.', 'L''après-midi : les prises (et les recommencements).', 'Le soir : premier visionnage du montage.');
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c26, 'youtube', v_today + 6);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'story', 'Sondage : ton plus gros blocage content', v_today + 7, 'tiktok', 'idea', p4, array[p4])
  returning id into v_c27;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c27, 'tiktok', v_today + 7);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', '3 idées de reels à copier cette semaine', v_today + 8, 'instagram', 'scheduled', p1, array[p1])
  returning id into v_c28;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c28, 'instagram', v_today + 8);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', 'Le mix de contenu qui fonctionne (40/30/30)', v_today + 10, 'instagram', 'programmed', p1, array[p1], 'Éducatif / Preuve sociale / Coulisses — le ratio qu''on utilise.')
  returning id into v_c29;
  insert into public.content_publications (content_id, platform, scheduled_date) values
    (v_c29, 'instagram', v_today + 10),
    (v_c29, 'facebook', v_today + 12);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'Merci à tous pour ce cap symbolique', v_today + 11, 'instagram', 'needs_revision', p2, array[p2], 'Draft à retravailler — trop long selon l''équipe.')
  returning id into v_c30;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c30, 'instagram', v_today + 11);
  insert into public.content_comments (content_id, target_type, target_id, user_id, body)
  values (v_c30, 'plan', 'general', v_user_id, 'On raccourcit la légende de moitié et on republie demain.');

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'infographic', 'Erreurs fréquentes en création de contenu', v_today + 13, 'linkedin', 'approved', p1, array[p1], 'Les 5 pièges classiques, et comment les éviter.')
  returning id into v_c31;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c31, 'linkedin', v_today + 13);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Le hook parfait en 3 secondes', v_today + 15, 'tiktok', 'idea', p1, array[p1])
  returning id into v_c32;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c32, 'tiktok', v_today + 15);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', 'Check-list avant de publier', v_today + 17, 'facebook', 'design', p1, array[p1], null)
  returning id into v_c33;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c33, 'facebook', v_today + 17);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'On répond à vos questions les plus posées', v_today + 19, 'instagram', 'programmed', p2, array[p2], 'FAQ spéciale — vos questions, nos réponses.')
  returning id into v_c34;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c34, 'instagram', v_today + 19);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'vlog', 'Behind the scenes équipe', v_today + 21, 'instagram', 'idea', p3, array[p3])
  returning id into v_c35;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c35, 'instagram', v_today + 21);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'story', 'Un conseil par jour cette semaine', v_today + 23, 'instagram', 'script', p4, array[p4])
  returning id into v_c36;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c36, 'instagram', v_today + 23);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Le format qui cartonne en ce moment', v_today + 26, 'instagram', 'idea', p1, array[p1])
  returning id into v_c37;
  insert into public.content_publications (content_id, platform, scheduled_date) values (v_c37, 'instagram', v_today + 26);

  -- =====================================================================
  -- 3) Idées en backlog (sans date — jamais signalées comme un problème) --
  -- =====================================================================

  insert into public.contents (id, brand_id, user_id, type, title, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'Idée : partenariat avec un autre créateur', 'idea', p3, array[p3])
  returning id into v_c38;
  insert into public.contents (id, brand_id, user_id, type, title, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Idée : réagir à une tendance TikTok', 'idea', p1, array[p1])
  returning id into v_c39;
  insert into public.contents (id, brand_id, user_id, type, title, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', 'Idée : comparatif avant/après client', 'idea', p2, array[p2])
  returning id into v_c40;
  insert into public.contents (id, brand_id, user_id, type, title, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'infographic', 'Idée : nos stats de l''année en un coup d''œil', 'idea', p1, array[p1])
  returning id into v_c41;

  raise notice 'MBS enrichie : 41 nouveaux contenus ajoutés (brand_id=%)', v_brand_id;
end $$;
