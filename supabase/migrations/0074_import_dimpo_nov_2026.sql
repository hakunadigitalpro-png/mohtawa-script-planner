-- Import du calendrier DIMPO Novembre 2026 depuis Notion.
-- 20 contenus (2 nov → 30 nov), tous en « en attente de validation »
-- sauf le 19 nov (« à Réviser »).
--
-- Mapping Notion → Kreatly :
--   type :  infographie → 'carousel' ; vidéo → 'reel' ; Photo → 'post'
--   status: en attente de validation → 'pending_review'
--           à Réviser → 'needs_revision'
--   platform : par défaut 'instagram' (DIMPO publie surtout là).
--
-- Idempotent SUR LE TITRE : on skip si un contenu avec le même titre
-- existe déjà dans la marque (pas de duplicata si on reapplique).

do $$
declare
  v_brand_id uuid;
  v_user_id  uuid;
begin
  -- Marque DIMPO
  select id into v_brand_id from public.brands where name = 'DIMPO' limit 1;
  if v_brand_id is null then
    raise exception 'Marque DIMPO introuvable. Crée-la d''abord ou corrige le nom.';
  end if;

  -- Auteur : le premier owner de la marque (celui qui l'a créée). Si
  -- plusieurs, on prend le premier arrivé.
  select user_id into v_user_id
  from public.brand_members
  where brand_id = v_brand_id and role = 'owner'
  order by created_at asc
  limit 1;
  if v_user_id is null then
    raise exception 'Pas d''owner trouvé sur la marque DIMPO.';
  end if;

  -- Insert : CTE source puis anti-join sur le titre pour l'idempotence.
  insert into public.contents (
    brand_id, user_id, type, title, date, platform, status, caption, created_at, updated_at
  )
  select
    v_brand_id,
    v_user_id,
    src.type,
    src.title,
    src.date::date,
    'instagram',
    src.status,
    src.caption,
    now(),
    now()
  from (
    values
    -- 2026-11-02 Lundi — infographie
    (
      '2026-11-02', 'carousel', 'pending_review',
      'Quand les dossiers commencent à s''accumuler',
      $post$💭 Quand les dossiers commencent à s'accumuler, chaque minute compte.
Documents à récupérer, clients à relancer, échanges à retrouver, suivis à faire…

Dans un cabinet comptable, ce sont souvent ces petites tâches qui finissent par prendre une grosse partie de la journée.

Et si vous pouviez simplifier tout ça?
C'est justement ce que des comptables canadiens apprécient chez Dimpo.

💬 « Un vrai gain de temps dans le suivi de nos dossiers. »
💬 « Une plateforme claire qui facilite notre organisation. »
💬 « Simple, rapide et efficace pour gérer nos échanges clients. »

Avec Dimpo, centralisez ce qui entoure vos dossiers et réduisez les suivis manuels :
✓ Collecte et gestion des documents
✓ Communications avec vos clients
✓ Relances automatisées
✓ Signature électronique
✓ Paiements en ligne
✓ Solution cloud sécurisée et conforme à la Loi 25

La prochaine saison d'impôt approche. Votre cabinet peut être prêt avant que le rush commence.
👉 Découvrez pourquoi des comptables d'ici choisissent Dimpo.

🎁 Testez Dimpo gratuitement : dimpo.ca/essai-gratuit

#Dimpo #ComptablesCanadiens #CPA #CPAQuébec #ComptableQuébec #CabinetComptable #Comptabilité #SaisonDImpôt #Automatisation #GestionDesDossiers #Loi25$post$
    ),
    -- 2026-11-03 Mardi — vidéo
    (
      '2026-11-03', 'reel', 'pending_review',
      'CPAs, Comptables et Préparateurs d''impôts',
      $post$💼 𝗖𝗣𝗔𝘀, 𝗖𝗼𝗺𝗽𝘁𝗮𝗯𝗹𝗲𝘀 𝗲𝘁 𝗣𝗿𝗲́𝗽𝗮𝗿𝗮𝘁𝗲𝘂𝗿𝘀 𝗱'𝗶𝗺𝗽𝗼̂𝘁𝘀 :
Vous en avez assez de trier des piles de reçus pendant la saison des impôts ?
Gagnez du temps et simplifiez votre travail avec DIMPO, la plateforme cloud conçue pour les comptables.

✨ Avec DIMPO, vous pouvez :

✅ Centraliser et numériser tous les documents clients
✅ Automatiser la facturation et la signature électronique
✅ Communiquer facilement avec vos clients via une messagerie sécurisée 💬
✅ Accéder à vos dossiers en tout temps, de n'importe où 🌍

🎁 Offre exclusive : testez DIMPO gratuitement dès maintenant – Sans engagement

#Loi25 #CPAQuébec #GestionComptable
#Dimpo #CPA #Comptabilité #CabinetComptable #TransformationNumérique #GestionDocumentaire #Productivité #PortailClient$post$
    ),
    -- 2026-11-04 Mercredi — infographie
    (
      '2026-11-04', 'carousel', 'pending_review',
      'I couldn''t imagine managing my files remotely any other way',
      $post$💬 "I couldn't imagine managing my files remotely any other way."

Managing clients and files remotely shouldn't be complicated.
That's why accounting professionals choose
Dimpo:  a simple, well-designed platform built for the realities of modern accounting firms.

🇨🇦 Built for Canadian accountants.
Trusted by 16,000+.

👉 Try Dimpo for free: dimpo.ca/essai-gratuit


#Dimpo #CanadianAccountants #CPA #AccountingFirms #AccountingSoftware #RemoteAccounting #CPAQuebec$post$
    ),
    -- 2026-11-05 Jeudi — infographie
    (
      '2026-11-05', 'carousel', 'pending_review',
      'Tax season success isn''t built during tax season',
      $post$Tax season success isn't built during tax season.

It's built months before.

November is the perfect time to:

✅ Review your workflows
✅ Eliminate repetitive tasks
✅ Standardize client communication
✅ Digitize document collection

The firms that invest time today spend less time chasing documents tomorrow.

With Dimpo, you're not just preparing for tax season.
You're building a smoother, more profitable workflow for your entire team.

Try Dimpo free now:
https://dimpo.ca/essai-gratuit/

#Accounting #CPA #TaxPreparation #WorkflowAutomation #Dimpo #CanadianCPA$post$
    ),
    -- 2026-11-06 Vendredi — infographie Bingo
    (
      '2026-11-06', 'carousel', 'pending_review',
      'Bingo fiscal du vendredi',
      $post$🎉Le Bingo fiscal du vendredi, c'est parti!

Chaque vendredi, cochez les cases que vous avez vécues dans la saison d'impôt.

 Combien de cases sur 8 avez-vous cochées?
 👇Répondez en commentaire.


 #BingoFiscal #VendrediBingo$post$
    ),
    -- 2026-11-09 Lundi — infographie
    (
      '2026-11-09', 'carousel', 'pending_review',
      'Pourquoi 16 000+ comptables canadiens ont déjà approuvé Dimpo',
      $post$🇨🇦Pourquoi 16 000+ comptables canadiens ont-ils déjà approuvé Dimpo?
Parce qu'une bonne solution doit être simple pour le comptable, sécurisée pour les clients et facile à utiliser au quotidien.

✔️ Une plateforme intuitive
✔️ Des échanges clients simplifiés
✔️ Une solution sécurisée
✔️ Une gestion des documents plus fluide

Ne nous croyez pas sur parole.
Découvrez ce que les comptables d'ici en pensent.

👉 Testez Dimpo gratuitement : dimpo.ca/essai-gratuit


#Dimpo #ComptablesCanadiens #CPA #CPAQuébec #CabinetComptable #Comptabilité #LogicielComptable #GestionDesDossiers #SécuritéDesDonnées #CommunicationClient$post$
    ),
    -- 2026-11-10 Mardi — vidéo
    (
      '2026-11-10', 'reel', 'pending_review',
      'Toi aussi, en novembre, ton téléphone commence déjà à sonner',
      $post$📞Toi aussi, en novembre, ton téléphone commence déjà à sonner sans arrêt?

Chez Julie, c'était 12 appels manqués… et toujours des signatures en attente.

Cette année, elle a décidé de ne pas attendre janvier pour s'organiser.

Avec Dimpo, ses clients déposent leurs documents, remplissent leur questionnaire pré-impôt et signent en ligne. Même la facturation est automatisée.

Résultat : moins de chasse aux clients, plus de contrôle sur ses dossiers.

 👀Et toi, tu vas attendre que la saison
commence pour t'organiser?

👉 Essaie Dimpo gratuitement dès maintenant.


🎁 Offre exclusive : testez DIMPO gratuitement dès maintenant – Sans engagement


#Dimpo #ComptableQuébécois  #comptable #CPAQuebec  #impots #ComptabilitéQuébec #SaisonDesImpôts #CabinetComptable #GestionCabinet #Comptabilité #Québec$post$
    ),
    -- 2026-11-11 Mercredi — infographie
    (
      '2026-11-11', 'carousel', 'pending_review',
      'What do Canadian accountants really think about Dimpo',
      $post$💬 What do Canadian accountants really think about Dimpo?
"A very useful and easy-to-navigate tool…"

Dimpo is designed for Canadian accounting firms looking to simplify client document collection, file management, client communication and accounting workflows.

✓ Easy-to-use accounting platform
✓ Centralized document management
✓ Streamlined client collaboration
✓ More productive accounting teams
🇨🇦Built for the realities of Canadian accountants.

👉 Try Dimpo for free:
dimpo.ca/essai-gratuit


#Dimpo #CanadianAccountants #CPA #AccountingFirms #CPAQuebec #AccountingSoftware #AccountingAutomation #DocumentManagement #ClientManagement #AccountingWorkflow #CanadianCPA$post$
    ),
    -- 2026-11-12 Jeudi — infographie
    (
      '2026-11-12', 'carousel', 'pending_review',
      'Et si vous récupériez le temps perdu dans la gestion des dossiers particuliers',
      $post$⏳ Et si vous récupériez le temps perdu dans la gestion de vos dossiers particuliers?

Entre la collecte de documents, les demandes clients et les suivis T1, les tâches administratives peuvent rapidement s'accumuler.

Avec Dimpo, centralisez vos dossiers et automatisez vos suivis pour travailler plus simplement et garder le contrôle.

🎁 Nouveaux clients : profitez gratuitement de Dimpo jusqu'au 31 décembre et commencez dès maintenant à transférer vos dossiers avant la prochaine saison d'impôt.

→Commencez dès maintenant, gratuitement
dimpo.ca/essai-gratuit


#Dimpo #CPA #ComptablesCanadiens #CPAQuébec #ComptableQuébec #CabinetComptable #T1 #SaisonDImpôt #AutomatisationComptable #GestionDesDossiers$post$
    ),
    -- 2026-11-13 Vendredi — infographie Bingo
    (
      '2026-11-13', 'carousel', 'pending_review',
      'Vendredi, c''est bingo - Vous vous reconnaissez',
      $post$Vendredi, c'est bingo!
Vous vous reconnaissez?
Votre collègue aussi.

😅Identifiez celle qui a déjà un bingo
complet.

#BingoFiscal #VendrediBingo$post$
    ),
    -- 2026-11-16 Lundi — infographie
    (
      '2026-11-16', 'carousel', 'pending_review',
      'Un bon outil ne se limite pas à simplifier le travail',
      $post$Un bon outil ne se limite pas à simplifier le travail. Il structure la collaboration.

Avec ses deux portails dédiés, comptable et client, Dimpo permet d'établir un cadre de travail clair, où chacun sait comment procéder et où les échanges sont mieux organisés.

Mais ce qui compte aussi, c'est la capacité d'évoluer.

Derrière Dimpo, une équipe engagée à faire évoluer la plateforme pour répondre aux besoins concrets des professionnels de la comptabilité, aujourd'hui comme demain.

🤝Parce qu'un cabinet moderne a besoin d'outils qui avancent avec lui.

👉 Découvrez Dimpo sur dimpo.ca

#comptable #comptables #CPA
#Dimpo #ComptablesQuébécois #CPAQuebec #ComptabilitéQuébec #CabinetComptable #impots #TransformationNumérique #TechnologieComptable$post$
    ),
    -- 2026-11-17 Mardi — infographie
    (
      '2026-11-17', 'carousel', 'pending_review',
      'Chaque saison d''impôt apporte son lot de pression',
      $post$Chaque saison d'impôt apporte son lot de pression. Pourtant, ce ne sont pas seulement les échéances qui créent le stress.

📂 Des documents envoyés par plusieurs canaux.
📞 Des suivis répétitifs avec les clients.
📧 Des informations dispersées entre les courriels, les appels et les fichiers.

Résultat : votre équipe perd un temps précieux sur des tâches administratives au lieu de se concentrer sur son expertise.

✅️Avec DIMPO, vous centralisez la collecte des documents, automatisez les rappels, suivez l'avancement de chaque dossier en temps réel et offrez une expérience numérique simple à vos clients.

✔La meilleure façon de réussir votre prochaine saison d'impôt est de commencer à vous organiser dès aujourd'hui.

Préparez votre cabinet maintenant, pour travailler plus efficacement demain.

Essayez Dimpo gratuitement:  https://dimpo.ca/essai-gratuit/

#Dimpo #Comptabilité #CabinetComptable #TransformationNumérique #SaisonImpôt #Productivité #CPA #Fiscalité #GestionDocumentaire$post$
    ),
    -- 2026-11-18 Mercredi — vidéo
    (
      '2026-11-18', 'reel', 'pending_review',
      'Transform Your Accounting Practice Today with Dimpo',
      $post$🌟 Transform Your Accounting Practice Today with Dimpo!

 📊 Discover how Dimpo can revolutionize your workflow, enhance client satisfaction, and ensure data security.

✨ Join the digital accounting revolution now!

👉 Try DIMPO for free :
https://dimpo.ca/essai-gratuit/

#Dimpo #Accounting #CPA #TaxSeason  #AccountingFirm #WorkflowManagement #TeamProductivity #DigitalTransformation #PracticeManagement #ClientExperience$post$
    ),
    -- 2026-11-19 Jeudi — infographie — À RÉVISER
    (
      '2026-11-19', 'carousel', 'needs_revision',
      'Still doing manually what could be automated',
      $post$Still doing manually what could be automated?

Missed invoices, duplicate payments, manual errors and delayed closings can quickly add up in an accounting firm.

With Dimpo, automate the tasks around your client files and spend less time on repetitive follow-ups.

⚡ Less manual work. Fewer errors. More time for what matters.

Built for Canadian accounting firms. 🇨🇦

👉 Try Dimpo for free:
 dimpo.ca/essai-gratuit



#Dimpo #AccountingAutomation #CanadianAccountants #CPA #AccountingFirms #CPAQuebec #Automation #AccountingSoftware #AccountingWorkflow$post$
    ),
    -- 2026-11-20 Vendredi — infographie Bingo
    (
      '2026-11-20', 'carousel', 'pending_review',
      'Bingo fiscal du vendredi - soupers, matchs et anniversaires',
      $post$Le Bingo fiscal du vendredi.

Les impôts, ce ne sont pas que des dossiers. Ce sont aussi des soupers, des matchs et des anniversaires qu'on aurait voulu ne pas manquer.

Quelle case vous a le plus parlé cette semaine?
👇Répondez en commentaire.


#BingoFiscal #VendrediBingo$post$
    ),
    -- 2026-11-23 Lundi — infographie
    (
      '2026-11-23', 'carousel', 'pending_review',
      'Un cabinet comptable peut-il vraiment gérer ses dossiers à distance',
      $post$Un cabinet comptable peut-il vraiment gérer ses dossiers à distance sans compliquer l'expérience de ses clients ?

💻Pour ce CPA, la réponse est claire : avec DIMPO, le travail à distance devient simple, structuré et efficace.

Une plateforme bien pensée, facile à utiliser pour les clients et conçue pour faciliter la collaboration entre le comptable et ses clients.

Découvrez pourquoi les professionnels choisissent DIMPO pour faire évoluer leur façon de travailler.

👉 Découvrez DIMPO sur www.dimpo.ca



#DIMPO #comptables #CPA #impots  #CPAQuebec #ComptablesQuébécois #ComptabilitéQuébec #CabinetComptable #GestionÀDistance #TransformationNumérique$post$
    ),
    -- 2026-11-24 Mardi — vidéo
    (
      '2026-11-24', 'reel', 'pending_review',
      'Vous envoyez encore des documents fiscaux sensibles par courriel',
      $post$Vous envoyez encore des documents fiscaux sensibles par courriel? 📩

Le problème, ce n'est pas seulement où le document est envoyé.

C'est aussi comment votre cabinet collecte, transmet, conserve et contrôle l'accès à ces informations.

Avec Dimpo, vous pouvez remplacer les échanges dispersés par courriel par un espace centralisé pour vos échanges avec vos clients.

🔐 Documents
📋 Questionnaires
✍️ Signatures électroniques
💳 Paiements

Tout au même endroit, dans un processus conçu pour mieux encadrer vos échanges de renseignements sensibles.

Votre cabinet mérite mieux qu'une boîte de réception pour gérer les documents de vos clients.

👉 Découvrez Dimpo et préparez un processus plus structuré pour votre cabinet.


#Dimpo #Loi25 #CPA #comptable #impots #ProtectionDesRenseignementsPersonnels #ComptablesQuébécois #CPAQuebec #ComptabilitéQuébec #CabinetComptable #SaisonDesImpôts #Cybersécurité #GestionCabine$post$
    ),
    -- 2026-11-25 Mercredi — infographie
    (
      '2026-11-25', 'carousel', 'pending_review',
      'Vous passez encore d''un outil à l''autre pour savoir où en sont vos dossiers',
      $post$Vous passez encore d'un outil à l'autre simplement pour savoir où en sont vos dossiers?

Avec le tableau de bord Dimpo, obtenez une vue claire de vos dossiers clients au même endroit.

📊 Suivez vos dossiers en un coup d'œil
📄 Identifiez rapidement les documents manquants
🔔 Gardez le contrôle sur vos relances
💬 Centralisez l'activité de vos clients
Moins de temps à chercher. Plus de contrôle sur votre gestion comptable.

🇨🇦 Pensé pour les cabinets comptables canadiens.

👉 Essayez Dimpo gratuitement : dimpo.ca/essai-gratuit



#Dimpo #ComptablesCanadiens #CPA #CabinetComptable #CPAQuébec #TableauDeBord #LogicielCom$post$
    ),
    -- 2026-11-26 Jeudi — infographie
    (
      '2026-11-26', 'carousel', 'pending_review',
      'La saison des impôts arrive',
      $post$La saison des impôts arrive… et avec elle, les documents à récupérer, les signatures à obtenir, les paiements à suivre et les nombreuses relances clients.

Mais votre cabinet n'a pas besoin d'attendre le début de la saison pour commencer à s'organiser.

Avec Dimpo, vous pouvez centraliser et simplifier plusieurs étapes de votre processus :

📄 Collecte et gestion des documents
✍️ Signature électronique
💳 Paiement électronique
📊 Suivi de l'avancement des dossiers

L'objectif ? Passer moins de temps sur les tâches administratives et consacrer davantage de temps à vos clients et à votre cabinet.

Préparez votre cabinet maintenant pour être prêt lorsque la saison commencera.

👉 Profitez de l'accès gratuit jusqu'au 31 décembre : dimpo.ca/essai-gratuit


#Dimpo, #CPA,  #impôt
#ComptablesCanada #ComptablesCanadiens  #SaisonDesImpôts #Fiscalité #CabinetComptable #AccountingFirm #TaxSeason #Dimpo$post$
    ),
    -- 2026-11-27 Vendredi — infographie Bingo
    (
      '2026-11-27', 'carousel', 'pending_review',
      'Cochez votre semaine - plateforme cloud',
      $post$Cochez votre semaine.
✅Vous avez coché plusieurs cases?

Notre case du milieu n'est pas là par hasard: une plateforme cloud peut aider à en rayer plusieurs (signatures, documents, facturation).

Découvrez comment sur dimpo.ca ;$post$
    ),
    -- 2026-11-30 Lundi — infographie
    (
      '2026-11-30', 'carousel', 'pending_review',
      'Pour un cabinet comptable, la simplicité fait toute la différence',
      $post$Pour un cabinet comptable, la simplicité fait toute la différence. 🤝

Centraliser ses outils, faciliter les échanges avec ses clients et leur offrir un espace sécurisé : c'est ce qui rend le quotidien plus fluide.

C'est justement ce qu'apprécie ce CPA québécois chez Dimpo : une plateforme simple à utiliser, qui rassemble l'essentiel au même endroit et facilite la gestion des dossiers à distance.

Parce qu'un bon outil ne devrait pas ajouter de complexité à votre travail, mais vous aider à mieux vous organiser.

👉 Découvrez Dimpo sur www.dimpo.ca



#Dimpo #CPAQuebec #ComptablesQuébécois #ComptabilitéQuébec #CabinetComptable #EspaceClient #GestionComptable #TransformationNumérique$post$
    )
  ) as src(date, type, status, title, caption)
  where not exists (
    select 1 from public.contents c
    where c.brand_id = v_brand_id
      and c.title = src.title
      and c.date = src.date::date
  );

  raise notice 'Import DIMPO Novembre 2026 : terminé.';
end$$;
