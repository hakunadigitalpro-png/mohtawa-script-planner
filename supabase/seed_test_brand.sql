-- =====================================================================
-- Seed — Marque de test entièrement remplie (MVP de démo/contrôle)
--
-- PAS une migration de schéma (pas de numéro, ne touche à aucune table/
-- colonne) — un script de DONNÉES à lancer une fois, à la main, dans le
-- SQL Editor Supabase, pour se retrouver avec une marque "Marque de test"
-- pré-remplie : 19 contenus (tous les formats), statuts variés, quelques
-- vues/perfs, des commentaires, pour pouvoir contrôler visuellement tout
-- ce qui a été construit (Dashboard, Calendrier, Analytics, Commentaires)
-- sans devoir tout créer à la main.
--
-- Relance sans risque : si "Marque de test" existe déjà, le script
-- supprime l'ancienne d'abord (cascade sur tout son contenu) et la
-- recrée propre.
--
-- Rattachée au compte hakuna.digitalpro@gmail.com (propriétaire).
-- =====================================================================

do $$
declare
  v_user_id   uuid;
  v_brand_id  uuid;
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid; v_c5 uuid;
  v_c6 uuid; v_c7 uuid; v_c8 uuid; v_c9 uuid; v_c10 uuid;
  v_c11 uuid; v_c12 uuid; v_c13 uuid; v_c14 uuid; v_c15 uuid;
  v_c16 uuid; v_c17 uuid; v_c18 uuid; v_c19 uuid;
  v_today date := current_date;
begin
  select id into v_user_id from auth.users where email = 'hakuna.digitalpro@gmail.com';
  if v_user_id is null then
    raise exception 'Compte hakuna.digitalpro@gmail.com introuvable — adapte l''email en haut du script.';
  end if;

  -- Nettoyage si déjà lancé une fois (cascade sur tout : contents, pillars,
  -- kit, publications, comments...).
  delete from public.brands where name = 'Marque de test' and created_by = v_user_id;

  -- 1) La marque -----------------------------------------------------
  insert into public.brands (id, name, created_by)
  values (gen_random_uuid(), 'Marque de test', v_user_id)
  returning id into v_brand_id;

  -- 2) Identité de marque ----------------------------------------------
  insert into public.brand_kits (brand_id, color_primary, color_secondary, color_accent, tagline, audience, voice, hashtags)
  values (
    v_brand_id, '#FF6B35', '#9C7DD8', '#14B8A6',
    'Des conseils simples pour des petites entreprises qui avancent.',
    'Patrons de petites entreprises en Tunisie, 30-50 ans, peu de temps, pas experts en marketing.',
    'Chaleureux et direct, on tutoie, zéro jargon, un peu d''humour.',
    array['conseilspme','petiteentreprise','tunisie']
  );

  -- 3) Thèmes de contenu -------------------------------------------------
  insert into public.brand_pillars (brand_id, name, position, objective, rubriques, examples, note, share_pct)
  values
    (v_brand_id, 'Conseils beauté', 1, 'Attirer de nouveaux clients en montrant l''expertise', array['Astuce rapide','Erreur à éviter','Avant/après'], array['3 astuces pour un feed cohérent','5 erreurs à éviter'], 'Le thème qui convertit le mieux', 40),
    (v_brand_id, 'Témoignages clients', 2, 'Rassurer et construire la confiance', array['Avis client','Résultat concret'], array['Nouveau témoignage client'], 'Preuve sociale', 25),
    (v_brand_id, 'Coulisses', 3, 'Créer du lien, montrer l''humain', array['Behind the scenes','Journée type'], array['Une journée type en agence'], 'Humanise la marque', 25),
    (v_brand_id, 'Inspiration', 4, 'Engager sans vendre', array['Citation','Motivation'], array['Citation motivante du lundi'], 'Contenu léger, facile à produire', 10);

  -- 4) Contenus à venir (7 prochains jours) — avec publications ----------
  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', '3 astuces pour un feed cohérent', v_today + 2, 'instagram', 'script', 'Conseils beauté', array['Conseils beauté'])
  returning id into v_c1;
  insert into public.reel_details (content_id, intro, point1, point2, point3, outro, script_full)
  values (v_c1, 'Ton feed a l''air désorganisé ?', 'Choisis 3 couleurs max.', 'Garde le même style de photo.', 'Planifie une semaine à l''avance.', 'Sauvegarde ce post pour plus tard !', null);
  insert into public.content_publications (content_id, platform, scheduled_date)
  values (v_c1, 'instagram', v_today + 2);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'story', 'Avant / après client — Sarra', v_today + 3, 'tiktok', 'idea', 'Témoignages clients', array['Témoignages clients'])
  returning id into v_c2;
  insert into public.content_publications (content_id, platform, scheduled_date)
  values (v_c2, 'tiktok', v_today + 3);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', '5 erreurs à éviter en début d''activité', v_today + 5, 'linkedin', 'pending_review', 'Conseils beauté', array['Conseils beauté'], '5 erreurs que j''ai faites en démarrant — et comment les éviter.')
  returning id into v_c3;
  insert into public.content_media (content_id, position, image_url) values
    (v_c3, 0, null), (v_c3, 1, null), (v_c3, 2, null);
  insert into public.content_publications (content_id, platform, scheduled_date)
  values (v_c3, 'linkedin', v_today + 5);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'vlog', 'Behind the scenes tournage', v_today + 6, 'instagram', 'idea', 'Coulisses', array['Coulisses'])
  returning id into v_c4;
  insert into public.content_publications (content_id, platform, scheduled_date)
  values (v_c4, 'instagram', v_today + 6);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'infographic', '5 chiffres à connaître sur les réseaux', v_today + 4, 'linkedin', 'programmed', 'Conseils beauté', array['Conseils beauté'], 'Les chiffres qui comptent vraiment en 2026.')
  returning id into v_c5;
  insert into public.content_media (content_id, position, image_url) values (v_c5, 0, null);
  insert into public.content_publications (content_id, platform, scheduled_date)
  values (v_c5, 'linkedin', v_today + 4);

  -- 5) Idées en backlog (sans date — ne doivent JAMAIS être signalées) ---
  insert into public.contents (id, brand_id, user_id, type, title, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'Citation motivante du lundi', 'idea', 'Inspiration', array['Inspiration'])
  returning id into v_c6;
  insert into public.contents (id, brand_id, user_id, type, title, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Erreur n°1 en marketing digital', 'idea', 'Conseils beauté', array['Conseils beauté'])
  returning id into v_c7;
  insert into public.contents (id, brand_id, user_id, type, title, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'story', 'Q&A avec la communauté', 'idea', 'Témoignages clients', array['Témoignages clients'])
  returning id into v_c8;

  -- 6) Publiés avec performances (mois courant + mois précédent) ---------
  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Comment j''ai commencé mon activité', (date_trunc('month', v_today) - interval '13 days')::date, 'instagram', 'published', 'Coulisses', array['Coulisses'])
  returning id into v_c9;
  insert into public.reel_details (content_id, intro, point1, point2, point3, outro)
  values (v_c9, 'On me demande souvent comment j''ai commencé...', 'Un déclic en 2022.', 'Beaucoup d''essais-erreurs.', 'Aujourd''hui je le referais pareil.', 'Et toi, ton histoire ?');
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c9, 850, 60, 12, 8, 20);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', '3 idées de contenu rapide à copier', date_trunc('month', v_today)::date + 1, 'instagram', 'live', 'Conseils beauté', array['Conseils beauté'], '3 idées à copier-coller cette semaine.')
  returning id into v_c10;
  insert into public.content_media (content_id, position, image_url) values
    (v_c10, 0, null), (v_c10, 1, null);
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c10, 1200, 90, 15, 22, 40);
  insert into public.content_publications (content_id, platform, scheduled_date) values
    (v_c10, 'instagram', date_trunc('month', v_today)::date + 1),
    (v_c10, 'facebook', date_trunc('month', v_today)::date + 4);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'vlog', 'Une journée type en agence', date_trunc('month', v_today)::date + 3, 'tiktok', 'published', 'Coulisses', array['Coulisses'])
  returning id into v_c11;
  insert into public.vlog_details (content_id, angle, hook, arc_situation, arc_development, arc_payoff, voiceover)
  values (v_c11, 'Une journée complète, sans filtre', 'Il est 7h, je n''ai pas encore de café...', 'Le matin : les mails.', 'Midi : appel client urgent.', 'Le soir : enfin le calme.', 'Voici à quoi ressemble vraiment une journée...');
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c11, 2100, 150, 30, 45, 60);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars, caption)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'Nouveau témoignage client', date_trunc('month', v_today)::date + 2, 'facebook', 'live', 'Témoignages clients', array['Témoignages clients'], '"Depuis qu''on travaille ensemble, tout a changé." — Sarra')
  returning id into v_c12;
  insert into public.content_media (content_id, position, image_url) values (v_c12, 0, null);
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c12, 430, 25, 5, 3, 10);

  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Top 3 outils que j''utilise au quotidien', (date_trunc('month', v_today) - interval '21 days')::date, 'instagram', 'published', 'Conseils beauté', array['Conseils beauté'])
  returning id into v_c13;
  insert into public.reel_details (content_id, intro, point1, point2, point3, outro)
  values (v_c13, '3 outils qui m''ont fait gagner un temps fou.', 'Outil 1 : la planification.', 'Outil 2 : les templates.', 'Outil 3 : l''automatisation.', 'Lequel tu utilises déjà ?');
  insert into public.performances (content_id, views, likes, comments, shares, saves)
  values (v_c13, 600, 40, 8, 5, 15);

  -- 7) Contenus plus loin dans le mois (pour dépasser le seuil "bravo"
  -- des 12 contenus/mois côté Dashboard, sans encombrer "Prochainement") -
  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'post', 'Le saviez-vous ?', date_trunc('month', v_today)::date + 13, 'instagram', 'programmed', 'Inspiration', array['Inspiration'])
  returning id into v_c14;
  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'reel', 'Question fréquente #1', date_trunc('month', v_today)::date + 15, 'tiktok', 'filming', 'Coulisses', array['Coulisses'])
  returning id into v_c15;
  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'story', 'Sondage de la semaine', date_trunc('month', v_today)::date + 17, 'instagram', 'editing', 'Témoignages clients', array['Témoignages clients'])
  returning id into v_c16;
  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'carousel', 'Récap de la semaine', date_trunc('month', v_today)::date + 19, 'linkedin', 'approved', 'Conseils beauté', array['Conseils beauté'])
  returning id into v_c17;
  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'infographic', 'Comparatif rapide', date_trunc('month', v_today)::date + 21, 'linkedin', 'design', 'Conseils beauté', array['Conseils beauté'])
  returning id into v_c18;
  insert into public.contents (id, brand_id, user_id, type, title, date, platform, status, pillar, pillars)
  values (gen_random_uuid(), v_brand_id, v_user_id, 'vlog', 'Idée en réserve', date_trunc('month', v_today)::date + 23, 'instagram', 'idea', 'Coulisses', array['Coulisses'])
  returning id into v_c19;

  -- 8) Commentaires (mélange équipe + "client" invité, pour tester le
  -- bouton commentaires + la mini-carte du Dashboard) --------------------
  insert into public.content_comments (content_id, target_type, target_id, user_id, guest_name, body)
  values (v_c1, 'plan', 'general', null, 'Sarra (cliente)', 'On peut changer le hook ? Je le trouve un peu plat.');
  insert into public.content_comments (content_id, target_type, target_id, user_id, body)
  values (v_c1, 'plan', 'general', v_user_id, 'Bonne remarque, je le retravaille pour demain.');
  insert into public.content_comments (content_id, target_type, target_id, user_id, guest_name, body)
  values (v_c3, 'plan', 'general', null, 'Sarra (cliente)', 'Validé pour vendredi, merci !');
  insert into public.content_comments (content_id, target_type, target_id, user_id, body)
  values (v_c10, 'plan', 'general', v_user_id, 'À republier dans 2 mois, ça avait bien marché.');

  raise notice 'Marque de test créée : %', v_brand_id;
end $$;
