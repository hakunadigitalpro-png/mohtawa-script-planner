"use client";

import { useTranslations } from "next-intl";
import { Languages, Sparkles, Users, Share2, type LucideIcon } from "lucide-react";

/**
 * Section "Pourquoi Mohtawa" — différenciateurs vs concurrence anglo-saxonne.
 * Layout 2 colonnes : titre/eyebrow à gauche, 4 features à droite.
 */
export function LandingWhy() {
  const t = useTranslations("landing.why");

  const items: { key: string; icon: LucideIcon }[] = [
    { key: "bilingual", icon: Languages },
    { key: "ai", icon: Sparkles },
    { key: "team", icon: Users },
    { key: "share", icon: Share2 },
  ];

  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: title block */}
          <div>
            <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
              {t("eyebrow")}
            </span>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              {t("subtitle")}
            </p>
          </div>

          {/* Right: items grid 2x2 */}
          <div className="grid gap-5 sm:grid-cols-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="rounded-3xl border border-border/60 bg-card p-5"
                >
                  <div className="inline-flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-bold text-foreground">
                    {t(`items.${item.key}.title`)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t(`items.${item.key}.description`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
