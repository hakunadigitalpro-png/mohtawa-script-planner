"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlanTab } from "./plan-tab";
import { ScriptTab } from "./script-tab";
import { StoryboardTab } from "./storyboard-tab";
import { ChecklistTab } from "./checklist-tab";
import { CaptionTab } from "./caption-tab";
import { PerformanceTab } from "./performance-tab";
import type {
  Content,
  ReelDetails,
  StoryDetails,
  StorySlide,
  StoryboardScene,
  Performance,
  ChecklistItem,
  ContentPublication,
} from "@/lib/types";

export function DetailTabs({
  content,
  reel,
  story,
  slides,
  scenes,
  perf,
  brandPillars,
  brandObjectives,
  checklistItems,
  equipmentSuggestions,
  preparationSuggestions,
  publications,
}: {
  content: Content;
  reel: ReelDetails | null;
  story: StoryDetails | null;
  slides: StorySlide[];
  scenes: StoryboardScene[];
  perf: Performance | null;
  brandPillars: { id: string; name: string }[];
  brandObjectives: { id: string; name: string }[];
  checklistItems: ChecklistItem[];
  equipmentSuggestions: { label: string; usage_count: number }[];
  preparationSuggestions: { label: string; usage_count: number }[];
  publications: ContentPublication[];
}) {
  const t = useTranslations("tabs");
  const isStory = content.type === "story";
  // L'onglet Performance ne sert à rien tant que la vidéo n'est pas publiée
  // (pas encore de données à saisir). On le masque pour réduire le bruit visuel.
  const isPublished = content.status === "published";

  return (
    <Tabs defaultValue="plan">
      <TabsList>
        <TabsTrigger value="plan">{t("plan")}</TabsTrigger>
        <TabsTrigger value="script">{isStory ? t("stories") : t("script")}</TabsTrigger>
        {!isStory && <TabsTrigger value="storyboard">{t("storyboard")}</TabsTrigger>}
        <TabsTrigger value="checklist">{t("checklist")}</TabsTrigger>
        {/* Caption Reels only — les Stories ont du texte par slide,
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
        <ScriptTab content={content} reel={reel} story={story} slides={slides} />
      </TabsContent>
      {!isStory && (
        <TabsContent value="storyboard">
          <StoryboardTab contentId={content.id} scenes={scenes} />
        </TabsContent>
      )}
      <TabsContent value="checklist">
        <ChecklistTab
          contentId={content.id}
          reel={reel}
          scenes={isStory ? undefined : scenes}
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
