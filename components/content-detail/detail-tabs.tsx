"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlanTab } from "./plan-tab";
import { ScriptTab } from "./script-tab";
import { VlogTab } from "./vlog-tab";
import { StoryboardTab } from "./storyboard-tab";
import { ChecklistTab } from "./checklist-tab";
import { CaptionTab } from "./caption-tab";
import { PerformanceTab } from "./performance-tab";
import type {
  Content,
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
  brandPillars,
  brandObjectives,
  checklistItems,
  equipmentSuggestions,
  preparationSuggestions,
  publications,
  scenePresets,
  brandId,
}: {
  content: Content;
  reel: ReelDetails | null;
  story: StoryDetails | null;
  vlog: VlogDetails | null;
  slides: StorySlide[];
  scenes: StoryboardScene[];
  perf: Performance | null;
  brandPillars: { id: string; name: string; objective?: string | null }[];
  brandObjectives: { id: string; name: string }[];
  checklistItems: ChecklistItem[];
  equipmentSuggestions: { label: string; usage_count: number }[];
  preparationSuggestions: { label: string; usage_count: number }[];
  publications: ContentPublication[];
  scenePresets: ScenePreset[];
  brandId: string;
}) {
  const t = useTranslations("tabs");
  const isStory = content.type === "story";
  const isVlog = content.type === "vlog";
  // Moments à filmer (catégorie 'capture') — affichés dans l'onglet Vlog,
  // pas dans la Checklist matériel/préparation.
  const captureItems = checklistItems.filter((it) => it.category === "capture");
  // L'onglet Performance ne sert à rien tant que la vidéo n'est pas publiée
  // (pas encore de données à saisir). On le masque pour réduire le bruit visuel.
  const isPublished = content.status === "published";

  return (
    <Tabs defaultValue="plan">
      <TabsList>
        <TabsTrigger value="plan">{t("plan")}</TabsTrigger>
        <TabsTrigger value="script">
          {isStory ? t("stories") : isVlog ? "Vlog" : t("script")}
        </TabsTrigger>
        {/* Storyboard = Reel uniquement (le vlog se capture, pas se story-borde). */}
        {!isStory && !isVlog && (
          <TabsTrigger value="storyboard">{t("storyboard")}</TabsTrigger>
        )}
        <TabsTrigger value="checklist">{t("checklist")}</TabsTrigger>
        {/* Caption pour Reel + Vlog — les Stories ont du texte par slide,
            pas une caption globale au moment de la publication. */}
        {!isStory && <TabsTrigger value="caption">Caption</TabsTrigger>}
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
      <TabsContent value="script">
        {isVlog ? (
          <VlogTab content={content} vlog={vlog} captureItems={captureItems} />
        ) : (
          <ScriptTab
            content={content}
            reel={reel}
            story={story}
            slides={slides}
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
          />
        </TabsContent>
      )}
      <TabsContent value="checklist">
        <ChecklistTab
          contentId={content.id}
          reel={reel}
          scenes={isStory || isVlog ? undefined : scenes}
          slides={isStory ? slides : undefined}
          checklistItems={checklistItems}
          equipmentSuggestions={equipmentSuggestions}
          preparationSuggestions={preparationSuggestions}
        />
      </TabsContent>
      {!isStory && (
        <TabsContent value="caption">
          <CaptionTab contentId={content.id} caption={content.caption} />
        </TabsContent>
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
