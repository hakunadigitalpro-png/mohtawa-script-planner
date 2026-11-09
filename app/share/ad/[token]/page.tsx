import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Eye, Target, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AD_OBJECTIVES, AD_STATUS_LABEL } from "@/lib/types-ads";
import { parsePreviewUrl } from "@/lib/preview-embed";

export const metadata = {
  title: "Campagne partagée — Kreatly",
  robots: { index: false, follow: false },
};

type SharedSlide = { visual_url: string | null; video_url: string | null; text: string | null };
type SharedAd = {
  name: string | null;
  hook: string | null;
  visual_url: string | null;
  video_url: string | null;
  slides: SharedSlide[];
};
type SharedAdSet = {
  name: string | null;
  targeting_age: string | null;
  targeting_location: string | null;
  targeting_interests: string | null;
  budget_daily: string | null;
  ads: SharedAd[];
};
type SharedCampaign = {
  brand: string | null;
  title: string;
  theme: string | null;
  platforms: string[] | null;
  objective: string | null;
  post_text: string | null;
  budget_global: string | null;
  budget_daily: string | null;
  date_start: string | null;
  date_end: string | null;
  status: string;
  targeting_age: string | null;
  targeting_location: string | null;
  targeting_interests: string | null;
  reach: number | null;
  clicks: number | null;
  leads: number | null;
  emails: number | null;
  essays: number | null;
  analysis: string | null;
  live_url: string | null;
  visuals: string[];
  ad_sets: SharedAdSet[];
};

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Une campagne publicitaire, ouverte à quiconque a le lien. Lecture seule, sans
 * compte, hors du menu de l'app. Le lien se crée et se coupe depuis la fiche.
 */
export default async function SharedAdCampaignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_ad_campaign", { p_token: token });
  if (error || !data) notFound();
  const c = data as SharedCampaign;

  const objective = AD_OBJECTIVES.find((o) => o.value === c.objective)?.label ?? c.objective;
  const status = AD_STATUS_LABEL[c.status as keyof typeof AD_STATUS_LABEL] ?? c.status;
  const period = c.date_start
    ? c.date_end && c.date_end !== c.date_start
      ? `Du ${formatDay(c.date_start)} au ${formatDay(c.date_end)}`
      : `Le ${formatDay(c.date_start)}`
    : null;
  const targeting = [c.targeting_age, c.targeting_location, c.targeting_interests].filter(Boolean);
  const results = [
    { label: "Portée", value: c.reach },
    { label: "Clics", value: c.clicks },
    { label: "Prospects", value: c.leads },
    { label: "E-mails", value: c.emails },
    { label: "Essais", value: c.essays },
  ].filter((r) => r.value !== null && r.value !== undefined);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          {c.brand && <span>{c.brand}</span>}
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 normal-case tracking-normal text-foreground">
            <Eye className="size-3.5" aria-hidden />
            Lecture seule
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl" dir="auto">
          {c.title}
        </h1>
        {c.theme && <p className="text-sm text-muted" dir="auto">{c.theme}</p>}
        <div className="flex flex-wrap gap-2 text-sm text-foreground">
          <span className="rounded-full bg-secondary px-3 py-1">{status}</span>
          {period && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
              <CalendarDays className="size-4" aria-hidden />
              {period}
            </span>
          )}
          {objective && <span className="rounded-full bg-secondary px-3 py-1">Objectif : {objective}</span>}
          {(c.platforms ?? []).length > 0 && (
            <span className="rounded-full bg-secondary px-3 py-1">{(c.platforms ?? []).join(" · ")}</span>
          )}
        </div>
      </header>

      {(c.budget_global || c.budget_daily || targeting.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {(c.budget_global || c.budget_daily) && (
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Wallet className="size-4" aria-hidden />
                Budget
              </p>
              {c.budget_global && <p className="text-sm text-foreground">Global : {c.budget_global}</p>}
              {c.budget_daily && <p className="text-sm text-foreground">Par jour : {c.budget_daily}</p>}
            </div>
          )}
          {targeting.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Target className="size-4" aria-hidden />
                Ciblage
              </p>
              {targeting.map((t) => (
                <p key={t} className="text-sm text-foreground" dir="auto">{t}</p>
              ))}
            </div>
          )}
        </section>
      )}

      {c.post_text && (
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">Texte de la publicité</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground" dir="auto">
            {c.post_text}
          </p>
        </section>
      )}

      {c.ad_sets.map((s, si) => {
        const setTargeting = [s.targeting_age, s.targeting_location, s.targeting_interests].filter(Boolean);
        return (
          <section key={si} className="space-y-3 rounded-3xl border border-border/60 bg-card p-4 sm:p-5">
            <div>
              <h2 className="text-base font-bold text-foreground" dir="auto">
                {s.name || (c.ad_sets.length > 1 ? `Groupe ${si + 1}` : "Les annonces")}
              </h2>
              {(setTargeting.length > 0 || s.budget_daily) && (
                <p className="mt-0.5 text-sm text-muted" dir="auto">
                  {[...setTargeting, s.budget_daily ? `${s.budget_daily} par jour` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {s.ads.map((a, ai) => (
                <AdBlock key={ai} ad={a} label={a.name || `Annonce ${ai + 1}`} />
              ))}
            </div>
          </section>
        );
      })}

      {c.ad_sets.length === 0 && c.visuals.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2">
          {c.visuals.map((url) => (
            <Visual key={url} url={url} />
          ))}
        </section>
      )}

      {(results.length > 0 || c.analysis) && (
        <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-4 sm:p-5">
          <h2 className="text-base font-bold text-foreground">Résultats</h2>
          {results.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {results.map((r) => (
                <div key={r.label} className="rounded-2xl bg-secondary px-3 py-2">
                  <dd className="text-lg font-bold text-foreground">
                    {(r.value as number).toLocaleString("fr-FR")}
                  </dd>
                  <dt className="text-xs text-muted">{r.label}</dt>
                </div>
              ))}
            </dl>
          )}
          {c.analysis && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground" dir="auto">
              {c.analysis}
            </p>
          )}
          {c.live_url && (
            <a
              href={c.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-semibold text-foreground underline underline-offset-4"
            >
              Voir la publicité en ligne
            </a>
          )}
        </section>
      )}

      <footer className="pt-4 text-center text-xs text-muted">Partagé avec Kreatly</footer>
    </main>
  );
}

/** Une annonce : son visuel ou sa vidéo, puis son texte ; un carrousel, diapo par diapo. */
function AdBlock({ ad, label }: { ad: SharedAd; label: string }) {
  const slides: SharedSlide[] =
    ad.slides.length > 0
      ? ad.slides
      : [{ visual_url: ad.visual_url, video_url: ad.video_url, text: ad.hook }];
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground" dir="auto">
        {label}
        {ad.slides.length > 1 && (
          <span className="font-normal text-muted"> · carrousel de {ad.slides.length}</span>
        )}
      </p>
      <div className={ad.slides.length > 1 ? "flex snap-x gap-3 overflow-x-auto pb-1" : ""}>
        {slides.map((sl, i) => (
          <div key={i} className={ad.slides.length > 1 ? "w-64 shrink-0 snap-start space-y-2" : "space-y-2"}>
            {sl.video_url ? (
              <Video url={sl.video_url} />
            ) : sl.visual_url ? (
              <Visual url={sl.visual_url} />
            ) : null}
            {sl.text && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground" dir="auto">
                {sl.text}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Visual({ url }: { url: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/40">
      <Image
        src={url}
        alt=""
        width={1080}
        height={1350}
        sizes="(max-width: 640px) 100vw, 420px"
        className="h-auto w-full"
      />
    </div>
  );
}

function Video({ url }: { url: string }) {
  const embed = parsePreviewUrl(url);
  if (!embed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl border border-border/60 bg-secondary/40 p-4 text-sm font-semibold text-foreground underline underline-offset-4"
      >
        Voir la vidéo
      </a>
    );
  }
  return (
    <div className="aspect-[9/16] max-h-[70vh] overflow-hidden rounded-2xl border border-border/60 bg-black">
      <iframe
        src={embed.src}
        title="Vidéo de l'annonce"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
