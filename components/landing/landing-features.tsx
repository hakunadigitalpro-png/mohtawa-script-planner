"use client";

import { useTranslations } from "next-intl";
import { Calendar, Wand2, Film, BarChart3, type LucideIcon } from "lucide-react";

/**
 * Section "Features" : 4 cards, chacune avec coin coloré comme la ref BrandBuzz.
 */
export function LandingFeatures() {
  const t = useTranslations("landing.features");

  const features: {
    key: "f1" | "f2" | "f3" | "f4";
    icon: LucideIcon;
    cornerColor: string;
    iconBg: string;
    iconColor: string;
  }[] = [
    {
      key: "f1",
      icon: Calendar,
      cornerColor: "bg-amber-400",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      key: "f2",
      icon: Wand2,
      cornerColor: "bg-emerald-400",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    {
      key: "f3",
      icon: Film,
      cornerColor: "bg-lavender",
      iconBg: "bg-lavender-soft",
      iconColor: "text-lavender-strong",
    },
    {
      key: "f4",
      icon: BarChart3,
      cornerColor: "bg-orange",
      iconBg: "bg-orange-soft",
      iconColor: "text-orange-strong",
    },
  ];

  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Eyebrow + title */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
            {t("eyebrow")}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            {t("subtitle")}
          </p>
        </div>

        {/* Cards grid */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.key}
                className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 transition hover:-translate-y-1 hover:shadow-[0_20px_60px_-20px_rgba(10,6,18,0.18)]"
              >
                {/* Coin coloré façon BrandBuzz */}
                <div
                  className={`absolute -top-6 -start-6 size-16 rounded-2xl ${f.cornerColor} opacity-90`}
                  aria-hidden
                />

                <div className="relative">
                  <div
                    className={`inline-flex size-12 items-center justify-center rounded-2xl ${f.iconBg}`}
                  >
                    <Icon className={`size-6 ${f.iconColor}`} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-foreground">
                    {t(`${f.key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(`${f.key}.description`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
