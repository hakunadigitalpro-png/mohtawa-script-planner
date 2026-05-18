import { Sparkles, Calendar, BarChart3, Film, Image as ImageIcon } from "lucide-react";

/**
 * Mockup CSS "browser frame" qui simule l'écran principal de Mohtawa.
 *
 * Pure HTML/CSS (pas d'image bitmap) → ultra léger, scale parfaitement, et
 * s'adapte automatiquement au dark mode et au RTL via les tokens existants.
 *
 * À terme : remplacer par une vraie capture du dashboard. Pour l'instant,
 * ce mockup transmet le "feeling produit" sans demander d'asset externe.
 */
export function LandingMockup() {
  return (
    <div className="relative">
      {/* Halo décoratif */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-br from-orange/25 via-lavender/15 to-transparent blur-2xl"
      />

      {/* Browser frame */}
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_30px_80px_-30px_rgba(10,6,18,0.35)]">
        {/* Top bar (faux Chrome) */}
        <div className="flex items-center gap-2 border-b border-border/40 bg-secondary/40 px-4 py-2.5">
          <span className="inline-block size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="inline-block size-2.5 rounded-full bg-[#febc2e]" />
          <span className="inline-block size-2.5 rounded-full bg-[#28c840]" />
          <div className="ms-3 hidden flex-1 sm:block">
            <div className="mx-auto h-5 max-w-xs rounded-full bg-card/80 text-[10px] flex items-center justify-center text-muted">
              mohtawa.tn / dashboard
            </div>
          </div>
        </div>

        {/* App body (mock) */}
        <div className="flex">
          {/* Sidebar */}
          <div className="hidden w-14 flex-shrink-0 flex-col items-center gap-3 border-e border-border/40 bg-secondary/30 py-4 sm:flex">
            <div className="inline-flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Sparkles className="size-4" />
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {[BarChart3, Calendar, Film, ImageIcon].map((Icon, i) => (
                <div
                  key={i}
                  className={`inline-flex size-9 items-center justify-center rounded-xl ${
                    i === 0
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-secondary"
                  }`}
                >
                  <Icon className="size-4" />
                </div>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 p-4 sm:p-6">
            {/* Page header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="h-5 w-28 rounded bg-foreground/85" />
                <div className="mt-2 h-3 w-40 rounded bg-foreground/15" />
              </div>
              <div className="h-8 w-24 rounded-full bg-accent" />
            </div>

            {/* KPIs */}
            <div className="mb-4 grid grid-cols-4 gap-2 sm:gap-3">
              <KpiCard accent />
              <KpiCard />
              <KpiCard />
              <KpiCard />
            </div>

            {/* Content cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <ContentCard kind="reel" />
              <ContentCard kind="story" />
              <ContentCard kind="reel" />
              <ContentCard kind="story" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ accent = false }: { accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-border/40 p-2.5 sm:p-3 ${
        accent ? "bg-accent/10" : "bg-card"
      }`}
    >
      <div
        className={`h-2 w-10 rounded ${
          accent ? "bg-accent/70" : "bg-foreground/30"
        }`}
      />
      <div
        className={`mt-2 h-5 w-12 rounded ${
          accent ? "bg-accent" : "bg-foreground/80"
        }`}
      />
    </div>
  );
}

function ContentCard({ kind }: { kind: "reel" | "story" }) {
  const tagColor =
    kind === "reel"
      ? "bg-orange/15 text-orange-strong"
      : "bg-lavender/15 text-lavender-strong";
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-3">
      <div className="aspect-video rounded-xl bg-gradient-to-br from-orange/10 via-lavender/10 to-transparent" />
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase ${tagColor}`}
        >
          {kind}
        </span>
        <div className="h-2 w-16 rounded bg-foreground/30" />
      </div>
      <div className="mt-1.5 h-3 w-3/4 rounded bg-foreground/15" />
    </div>
  );
}
