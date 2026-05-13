"use client";

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
  StoryboardScene,
  Performance,
} from "@/lib/types";

export function DetailTabs({
  content,
  reel,
  story,
  scenes,
  perf,
}: {
  content: Content;
  reel: ReelDetails | null;
  story: StoryDetails | null;
  scenes: StoryboardScene[];
  perf: Performance | null;
}) {
  const isStory = content.type === "story";

  return (
    <Tabs defaultValue="plan">
      <TabsList>
        <TabsTrigger value="plan">Plan</TabsTrigger>
        <TabsTrigger value="script">{isStory ? "Stories" : "Script"}</TabsTrigger>
        {!isStory && <TabsTrigger value="storyboard">Storyboard</TabsTrigger>}
        <TabsTrigger value="checklist">Checklist</TabsTrigger>
        <TabsTrigger value="performance">Performances</TabsTrigger>
      </TabsList>
      <TabsContent value="plan">
        <PlanTab content={content} />
      </TabsContent>
      <TabsContent value="script">
        <ScriptTab content={content} reel={reel} story={story} />
      </TabsContent>
      {!isStory && (
        <TabsContent value="storyboard">
          <StoryboardTab contentId={content.id} scenes={scenes} />
        </TabsContent>
      )}
      <TabsContent value="checklist">
        <ChecklistTab contentId={content.id} reel={reel} />
      </TabsContent>
      <TabsContent value="performance">
        <PerformanceTab contentId={content.id} perf={perf} />
      </TabsContent>
    </Tabs>
  );
}
