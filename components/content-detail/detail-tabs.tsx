"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlanTab } from "./plan-tab";
import { ScriptTab } from "./script-tab";
import { VlogTab } from "./vlog-tab";
import { StoryboardTab } from "./storyboard-tab";
import { CaptionTab } from "./caption-tab";
import { ContentTab } from "./content-tab";
import { FirstCommentTab } from "./first-comment-tab";
import { VideoTab } from "./video-tab";
import { PerformanceTab } from "./performance-tab";
import { isSimpleType, isLiveStatus } from "@/lib/constants";
import type {
  Content,
  ContentMedia,
  ReelDetails,
  StoryDetails,
  VlogDetails,
  StorySlide,
  StoryboardScene,
  Performance,
  ChecklistItem,
  ContentPublication,
  ScenePreset,
} from "@/lib/types";

export function DetailTabs({
  defaultTab,
  content,
  reel,
  story,
  vlog,
  slides,
  scenes,
  perf,
  visuals,
  brandPillars,
  brandObjectives,
  checklistItems,
  publications,
  scenePresets,
  brandId,
  brandAudience,
  aiEnabled = true,
}: {
  /** Onglet à ouvrir par défaut (via ?tab=…). Validé plus bas. */
  defaultTab?: string;
  content: Content;
  reel: ReelDetails | null;
  story: StoryDetails | null;
  vlog: VlogDetails | null;
  slides: StorySlide[];
  scenes: StoryboardScene[];
  perf: Performance | null;
  visuals: ContentMedia[];
  brandPillars: { id: string; name: string; objective?: string | null }[];
  brandObjectives: { id: string; name: string }[];
  /** Toujours nécessaires : le Vlog en tire sa liste de plans à capturer. */
  checklistItems: ChecklistItem[];
  publications: ContentPublication[];
  scenePresets: ScenePreset[];
  brandId: string;
  brandAudience: string | null;
  /**
   * Interrupteur IA de la marque (0054), porté jusqu'ici par
   * `resolveActiveBrand()` plutôt que par une requête de plus à chaque
   * écran qui affiche un bouton.
   */
  aiEnabled?: boolean;
}) {
  const t = useTranslations("tabs");
  const isStory = content.type === "story";
  const isVlog = content.type === "vlog";
  // Formats "simples" (post/carrousel/infographie) : éditeur allégé
  // (Plan + Contenu), sans Script ni Storyboard.
  const isSimple = isSimpleType(content.type);
  // Une idée n'a pas encore de format (0055) : aucun éditeur ne lui
  // correspond. Sans ce cas, `isSimpleType(null)` valant false, on lui
  // proposerait Script, Storyboard et Caption — des onglets vides pour
  // quelque chose dont on ignore encore si ce sera une vidéo.
  const hasFormat = Boolean(content.type);
  // Masquer Script + Storyboard quand la vidéo est déjà prête (0063) :
  // on l'autorise seulement si un lien a bien été renseigné, pour qu'un
  // oubli de case cochée ne vide pas tous les onglets utiles.
  const hideProduction =
    Boolean(content.hide_production_tabs) && Boolean(content.preview_url);
  // Moments à filmer (catégorie 'capture') — affichés dans l'onglet Vlog,
  // pas dans la Checklist matériel/préparation.
  const captureItems = checklistItems.filter((it) => it.category === "capture");
  // L'onglet Performance ne sert à rien tant que la vidéo n'est pas publiée
  // (pas encore de données à saisir). On le masque pour réduire le bruit visuel.
  const isPublished = isLiveStatus(content.status);

  // Garde-fou : un `?tab=…` incohérent (onglet masqué, format qui ne l'a
  // pas) ou vide retombe sur « plan » plutôt qu'ouvrir une page vide.
  const ALLOWED = new Set<string>(["plan", "video", "performance"]);
  if (isSimple) {
    ALLOWED.add("content");
    ALLOWED.add("first-comment");
  } else if (hasFormat) {
    if (!hideProduction) ALLOWED.add("script");
    if (!isStory && !isVlog && !hideProduction) ALLOWED.add("storyboard");
    if (!isStory) ALLOWED.add("caption");
  }
  const initial = defaultTab && ALLOWED.has(defaultTab) ? defaultTab : "plan";

  return (
    <Tabs defaultValue={initial}>
      <TabsList data-tour="content-tabs">
        <TabsTrigger value="plan">{t("plan")}</TabsTrigger>
        {!hasFormat ? null : isSimple ? (
          /* Post / Carrousel / Infographie : Contenu (visuels + légende),
             onglet Vidéo (lien externe) puis premier commentaire. */
          <>
            <TabsTrigger value="content">Contenu</TabsTrigger>
            <TabsTrigger value="video">Vidéo</TabsTrigger>
            <TabsTrigger value="first-comment">Commentaires</TabsTrigger>
          </>
        ) : (
          <>
            {/* Script + Storyboard masqués quand la vidéo est déjà prête et
                que l'utilisatrice a coché « cacher la production » dans
                l'onglet Vidéo — leur contenu reste en base, juste caché ici. */}
            {!hideProduction && (
              <TabsTrigger value="script">
                {isStory ? t("stories") : isVlog ? "Vlog" : t("script")}
              </TabsTrigger>
            )}
            {/* Storyboard = Reel uniquement (le vlog se capture, pas se story-borde). */}
            {!isStory && !isVlog && !hideProduction && (
              <TabsTrigger value="storyboard">{t("storyboard")}</TabsTrigger>
            )}
            {/* Onglet Vidéo APRÈS Storyboard : lien Drive/YouTube/Vimeo de
                la vidéo déjà prête, avec aperçu intégré. */}
            <TabsTrigger value="video">Vidéo</TabsTrigger>
            {/* Caption pour Reel + Vlog — les Stories ont du texte par slide,
                pas une caption globale au moment de la publication. */}
            {!isStory && <TabsTrigger value="caption">Légende</TabsTrigger>}
          </>
        )}
        {isPublished && <TabsTrigger value="performance">{t("performance")}</TabsTrigger>}
      </TabsList>

      <TabsContent value="plan">
        <PlanTab
          content={content}
          brandPillars={brandPillars}
          brandObjectives={brandObjectives}
          publications={publications}
        />
      </TabsContent>

      {!hasFormat ? null : isSimple ? (
        <>
          <TabsContent value="content">
            <ContentTab
              aiEnabled={aiEnabled}
              contentId={content.id}
              caption={content.caption}
              visuals={visuals}
              isCarousel={content.type === "carousel"}
            />
          </TabsContent>
          <TabsContent value="video">
            <VideoTab
              contentId={content.id}
              previewUrl={content.preview_url}
              hideProductionTabs={content.hide_production_tabs}
              canOfferHide={false}
            />
          </TabsContent>
          <TabsContent value="first-comment">
            <FirstCommentTab
              contentId={content.id}
              firstComment={content.first_comment}
            />
          </TabsContent>
        </>
      ) : (
        <>
          {!hideProduction && (
            <TabsContent value="script">
              {isVlog ? (
                <VlogTab
                  brandAudience={brandAudience}
                  aiEnabled={aiEnabled} content={content} vlog={vlog} captureItems={captureItems} />
              ) : (
                <ScriptTab
                  aiEnabled={aiEnabled}
                  content={content}
                  reel={reel}
                  story={story}
                  slides={slides}
                  brandAudience={brandAudience}
                />
              )}
            </TabsContent>
          )}
          {!isStory && !isVlog && !hideProduction && (
            <TabsContent value="storyboard">
              <StoryboardTab
                contentId={content.id}
                scenes={scenes}
                scenePresets={scenePresets}
                brandId={brandId}
                filmingGuide={reel?.filming_guide ?? null}
                reel={reel}
              />
            </TabsContent>
          )}
          <TabsContent value="video">
            <VideoTab
              contentId={content.id}
              previewUrl={content.preview_url}
              hideProductionTabs={content.hide_production_tabs}
              canOfferHide={!isStory}
            />
          </TabsContent>
          {!isStory && (
            <TabsContent value="caption">
              <CaptionTab
                contentId={content.id}
                caption={content.caption}
                aiEnabled={aiEnabled}
              />
            </TabsContent>
          )}
        </>
      )}

      {isPublished && (
        <TabsContent value="performance">
          <PerformanceTab
            contentId={content.id}
            perf={perf}
            publications={publications}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
