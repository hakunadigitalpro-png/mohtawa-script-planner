"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlanTab } from "./plan-tab";
import { ScriptTab } from "./script-tab";
import { StoryboardTab } from "./storyboard-tab";
import { ChecklistTab } from "./checklist-tab";
import { PerformanceTab } from "./performance-tab";
import type {
  Content,
  ReelDetails,
  StoryDetails,
  StorySlide,
  StoryboardScene,
  Performance,
  ChecklistItem,
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
}) {
  const t = useTranslations("tabs");
  const isStory = content.type === "story";

  return (
    <Tabs defaultValue="plan">
      <TabsList>
        <TabsTrigger value="plan">{t("plan")}</TabsTrigger>
        <TabsTrigger value="script">{isStory ? t("stories") : t("script")}</TabsTrigger>
        {!isStory && <TabsTrigger value="storyboard">{t("storyboard")}</TabsTrigger>}
        <TabsTrigger value="checklist">{t("checklist")}</TabsTrigger>
        <TabsTrigger value="performance">{t("performance")}</TabsTrigger>
      </TabsList>
      <TabsContent value="plan">
        <PlanTab
          content={content}
          brandPillars={brandPillars}
          brandObjectives={brandObjectives}
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
      <TabsContent value="performance">
        <PerformanceTab contentId={content.id} perf={perf} />
      </TabsContent>
    </Tabs>
  );
}
