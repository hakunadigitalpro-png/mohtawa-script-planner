"use client";

import { useTranslations } from "next-intl";
import { User, Building2, Briefcase, type LucideIcon } from "lucide-react";

/**
 * Section "Pour qui" — 3 personas en cartes, avec tag coloré en haut.
 */
export function LandingPersonas() {
  const t = useTranslations("landing.personas");

  const personas: {
    key: "p1" | "p2" | "p3";
    icon: LucideIcon;
    tagBg: string;
    tagColor: string;
    accent: boolean;
  }[] = [
    {
      key: "p1",
      icon: User,
      tagBg: "bg-emerald-100",
      tagColor: "text-emerald-700",
      accent: true, // Mis en avant (le plus courant)
    },
    {
      key: "p2",
      icon: Building2,
      tagBg: "bg-lavender-soft",
      tagColor: "text-lavender-strong",
      accent: false,
    },
    {
      key: "p3",
      icon: Briefcase,
      tagBg: "bg-orange-soft",
      tagColor: "text-orange-strong",
      accent: false,
    },
  ];

  return (
    <section id="personas" className="scroll-mt-20 py-20 sm:py-24">
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

        {/* Cards */}
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {personas.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.key}
                className={`relative flex flex-col rounded-3xl border p-6 transition hover:-translate-y-1 ${
                  p.accent
                    ? "border-accent/40 bg-accent/5 shadow-[0_20px_60px_-30px_rgba(255,107,53,0.4)]"
                    : "border-border/60 bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`inline-flex size-12 items-center justify-center rounded-2xl ${
                      p.accent ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    <Icon className="size-6" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${p.tagBg} ${p.tagColor}`}
                  >
                    {t(`${p.key}.tag`)}
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold text-foreground">
                  {t(`${p.key}.title`)}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`${p.key}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
