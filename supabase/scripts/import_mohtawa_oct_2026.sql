-- Import du planning Mohtawa.tn Octobre 2026 (depuis Notion)
--
-- À exécuter DANS LE SQL EDITOR DE SUPABASE, UNE SEULE FOIS.
-- Avant d'exécuter : vérifie que la marque « Mohtawa.tn » existe (ou renomme-la).
--
-- Ce script :
--   1. Récupère l'id de la marque Mohtawa.tn
--   2. Récupère l'id de l'utilisatrice owner de cette marque
--   3. Insère 7 contenus avec statut, date, légende, format, plateforme
--
-- Idempotent : relancer ne crée pas de doublons (clé = brand_id + date + title).

do $$
declare
  v_brand uuid;
  v_user  uuid;
begin
  select id into v_brand
    from public.brands
   where lower(name) = 'mohtawa.tn'
   limit 1;
  if v_brand is null then
    raise exception 'Marque Mohtawa.tn introuvable. Crée-la d''abord.';
  end if;

  select user_id into v_user
    from public.brand_members
   where brand_id = v_brand and role = 'owner'
   limit 1;
  if v_user is null then
    raise exception 'Pas d''owner trouvé pour cette marque.';
  end if;

  -- Les 7 contenus. `pending_review` = « en attente de validation »,
  -- `approved` = « validé », tous Instagram, formats Reel ou Carrousel.
  insert into public.contents (
    brand_id, user_id, type, title, date, platform, platforms, status, caption
  )
  values
    (
      v_brand, v_user, 'reel',
      'Annonce',
      '2026-10-08', 'instagram', ARRAY['instagram'], 'idea',
      'Anonnce'
    ),
    (
      v_brand, v_user, 'reel',
      'تحضير المحتوى ياخذ وقت كبير…',
      '2026-10-10', 'instagram', ARRAY['instagram'], 'approved',
      E'تحضير المحتوى ياخذ وقت كبير كي كل مرة تبدأ من الصفر.\nفي MOHTAWA تلقى الصفحات والأدوات اللي تعاونك تنظّم خدمتك وتحوّل أفكارك لمحتوى جاهز للنشر:\n📝 تخطيط شهري\n🎬 طريقة تحضير الـReels\n💡 +150 صفحة وأفكار تساعدك\n🎯 Hooks جاهزة\n📱 Storyboards للتصوير\n📊 متابعة وتنظيم المحتوى\nخلي عندك بلاصة وحدة تجمع فيها أفكارك، تخطّط وتخدم على المحتوى متاعك.\n📖 MOHTAWA.tn — أوّل Planner تونسي مصمّم لصانعي المحتوى\n\nPassez vos commande : Mohtawa.tn\n\n#MohtawaTN #صناعة_المحتوى #ContentCreatorTunisia #ContentPlanning #MarketingTunisie'
    ),
    (
      v_brand, v_user, 'reel',
      'عندك أفكار برشا للمحتوى…',
      '2026-10-12', 'instagram', ARRAY['instagram'], 'approved',
      E'عندك أفكار برشا للمحتوى، أما كل مرة تلقى روحك ما تعرفش منين تبدأ؟\n\nبين الأفكار، التصوير، كتابة الـReels وتنظيم النشر، المحتوى ينجم بسهولة يولي حاجة مؤجلة كل مرة.\n✨MOHTAWA.tn ✨\nيعاونك ترتّب أفكارك، تخطّط للشهر وتحضّر المحتوى متاعك بطريقة أوضح وأسهل.\n\nباش كل فكرة تلقاها بلاصتها، وكل Reel يكون عندو هدف واضح.\n\n📖 MOHTAWA.tn — أوّل Planner تونسي مصمّم لصانعي المحتوى\n\nPassez vos commande : Mohtawa.tn\n\n#MohtawaTN #صناعة_المحتوى #ContentCreatorTunisia #ContentPlanning #MarketingTunisie'
    ),
    (
      v_brand, v_user, 'carousel',
      'عندك مشروع، personal brand ولا service…',
      '2026-10-14', 'instagram', ARRAY['instagram'], 'approved',
      E'عندك مشروع، personal brand ولا service وتحب تكون حاضر بانتظام على السوشيال ميديا؟\n\nMohtawa.tn يجمعلك المراحل الأساسية متاع صناعة المحتوى في Planner واحد.\nتبدأ من الاستراتيجية: تحدد الـpositionnement، الـpersona، الـcontent pillars والأهداف متاعك.\nوبعدها تمشي للتخطيط والتنفيذ: أفكار، Reels، Scripts، Storyboards، تخطيط أسبوعي وشهري، وتحليل النتائج.\n\nوحتى كي تجيك فكرة جديدة، تلقى عندك المسار واضح:\nIdea → Script → Scènes → Storyboard → Tournage 🎬\n\n✨الهدف؟ يكون عندك Direction واضحة للمحتوى متاعك وتخدم بطريقة منظمة، من غير ما كل مرة تبدأ من الصفر.\n\n📖 MOHTAWA.tn — أوّل Planner تونسي مصمّم لصانعي المحتوى\nجاهز تنظّم محتواك؟\nPassez vos commande : Mohtawa.tn'
    ),
    (
      v_brand, v_user, 'reel',
      'خلينا في عوض نتشاكو من النتائج…',
      '2026-10-16', 'instagram', ARRAY['instagram'], 'pending_review',
      E'خلينا في عوض نتشاكو من النتائج نتعلمو كيفاش نخدمو بطريقة مبنية على أسس صحيحة.\n🤌كان باش تقعد في كل مرة تجيك فكرة فقط تصورها و تهبطها ، نقلك من توا صعيب برشا تلقى نتيجة .\n👈أول حاجة يلزمك تكون محدد هدف الشهر ، الركائز الي باش تركز عليهم و المواضيع الي باش تحكي عليهم .\nو هكة ماعدتش نحكيو على محتوى عشوائي.\n😎و هوني يجي دور Mohtawa.tn , أول planner تونسية لصناع المحتوة ، تخليك تكون مستمر في صناعة محتوى يبيع.\n👇Passez voc commandes :\nMohtawa.tn'
    ),
    (
      v_brand, v_user, 'reel',
      'الماتريال الي مصنوعة منو planner…',
      '2026-10-19', 'instagram', ARRAY['instagram'], 'approved',
      E'👌الماتريال الي مصنوعة منو planner إخترناه بدقة شديدة .\n💫الهدف انو planner تقعد intacte على خاطر باش تكون هي شريك صانع المحتوى في التسويق.\n✅️لذلك اختارنا carton خشين بالباهي .\n✅️و عملناها ب ressort باش تنجم تتحكم فيها.\n✅️و إخترنا أنو حجمها يكون مناسب باش تنجم تتهز بسهولة في sac متاعك.\n\n📖 MOHTAWA.tn — أوّل Planner تونسي مصمّم لصانعي المحتوى\nجاهز تنظّم محتواك؟\nPassez vos commande : Mohtawa.tn'
    ),
    (
      v_brand, v_user, 'carousel',
      'Carrousel sans date (Mercredi)',
      null, 'instagram', ARRAY['instagram'], 'pending_review',
      null
    )
  on conflict do nothing;
end $$;
