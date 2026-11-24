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
import { LongformTab } from "./longform-tab";
import { ExtractsTab } from "./extracts-tab";
import { isLiveStatus, isSimpleType, isWideType } from "@/lib/constants";
import { longformSpec } from "@/lib/longform";
import type {
  Content,
  ContentMedia,
  ContentSection,
  DerivedContent,
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
import type { TeamMember } from "@/lib/brand-team";

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
  team,
  brandObjectives,
  checklistItems,
  publications,
  scenePresets,
  brandId,
  brandAudience,
  sections,
  derived,
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
  team: TeamMember[];
  brandObjectives: { id: string; name: string }[];
  /** Toujours nécessaires : le Vlog en tire sa liste de plans à capturer. */
  checklistItems: ChecklistItem[];
  publications: ContentPublication[];
  scenePresets: ScenePreset[];
  brandId: string;
  brandAudience: string | null;
  /** Formats longs : parties, invité et transcription (0101). */
  sections: ContentSection[];
  /** Formats longs : les contenus qu'on en a tirés (0100). */
  derived: DerivedContent[];
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
  // Formats longs (vidéo longue, direct, podcast, article) : un éditeur en
  // parties, une présentation, des extraits.
  const longform = longformSpec(content.type);
  const isSimple = isSimpleType(content.type) && !longform;
  const hasVideo = content.type !== "article";
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
  if (longform) {
    for (const tab of ["parts", "content", "extracts"]) ALLOWED.add(tab);
    if (!hasVideo) ALLOWED.delete("video");
  } else if (isSimple) {
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
        {!hasFormat ? null : longform ? (
          <>
            <TabsTrigger value="parts">{longform.tab}</TabsTrigger>
            {hasVideo && <TabsTrigger value="video">Vidéo</TabsTrigger>}
            <TabsTrigger value="content">Présentation</TabsTrigger>
            <TabsTrigger value="extracts">Extraits</TabsTrigger>
          </>
        ) : isSimple ? (
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
          team={team}
        />
      </TabsContent>

      {!hasFormat ? null : longform ? (
        <>
          <TabsContent value="parts">
            <LongformTab
              content={content}
              sections={sections}
              aiEnabled={aiEnabled}
            />
          </TabsContent>
          {hasVideo && (
            <TabsContent value="video">
              <VideoTab
                contentId={content.id}
                previewUrl={content.preview_url}
                hideProductionTabs={false}
                canOfferHide={false}
                wide={isWideType(content.type)}
              />
            </TabsContent>
          )}
          <TabsContent value="content">
            <ContentTab
              aiEnabled={aiEnabled}
              contentId={content.id}
              caption={content.caption}
              visuals={visuals}
              isCarousel={false}
              presentation={longform}
            />
          </TabsContent>
          <TabsContent value="extracts">
            <ExtractsTab
              content={content}
              transcript={
                sections.find((s) => s.kind === "transcript")?.body ?? null
              }
              derived={derived}
              hasText={sections.some(
                (s) => s.kind === "section" && Boolean(s.body?.trim()),
              )}
              aiEnabled={aiEnabled}
            />
          </TabsContent>
        </>
      ) : isSimple ? (
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
