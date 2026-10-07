"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlanTab } from "./plan-tab";
import { ScriptTab } from "./script-tab";
import { VlogTab } from "./vlog-tab";
import { StoryboardTab } from "./storyboard-tab";
import { CaptionTab } from "./caption-tab";
import { ContentTab } from "./content-tab";
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
  // Moments à filmer (catégorie 'capture') — affichés dans l'onglet Vlog,
  // pas dans la Checklist matériel/préparation.
  const captureItems = checklistItems.filter((it) => it.category === "capture");
  // L'onglet Performance ne sert à rien tant que la vidéo n'est pas publiée
  // (pas encore de données à saisir). On le masque pour réduire le bruit visuel.
  const isPublished = isLiveStatus(content.status);

  return (
    <Tabs defaultValue="plan">
      <TabsList>
        <TabsTrigger value="plan">{t("plan")}</TabsTrigger>
        {!hasFormat ? null : isSimple ? (
          /* Post / Carrousel / Infographie : un seul onglet "Contenu"
             (légende + visuels), pas de Script/Storyboard. */
          <TabsTrigger value="content">Contenu</TabsTrigger>
        ) : (
          <>
            <TabsTrigger value="script">
              {isStory ? t("stories") : isVlog ? "Vlog" : t("script")}
            </TabsTrigger>
            {/* Storyboard = Reel uniquement (le vlog se capture, pas se story-borde). */}
            {!isStory && !isVlog && (
              <TabsTrigger value="storyboard">{t("storyboard")}</TabsTrigger>
            )}
            {/* Onglet Checklist retiré de l'affichage (reel, story, vlog) :
                la préparation se gère ailleurs. Le composant reste dans le
                repo (checklist-tab.tsx) et les données en base ne sont pas
                touchées — remettre ce déclencheur et son contenu suffit. */}
            {/* Caption pour Reel + Vlog — les Stories ont du texte par slide,
                pas une caption globale au moment de la publication. */}
            {!isStory && <TabsTrigger value="caption">Caption</TabsTrigger>}
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
        <TabsContent value="content">
          <ContentTab
            aiEnabled={aiEnabled}
            contentId={content.id}
            caption={content.caption}
            visuals={visuals}
            isCarousel={content.type === "carousel"}
          />
        </TabsContent>
      ) : (
        <>
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
          {!isStory && !isVlog && (
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
