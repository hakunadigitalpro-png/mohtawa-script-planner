"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";

type Mode = "signin" | "signup";

/**
 * Carte d'authentification style « Diprella », palette Kreatly (noir + orange).
 * Le panneau coloré occupe 1/3, le formulaire 2/3 ; le panneau noir glisse d'un
 * côté à l'autre pour basculer connexion ⇄ inscription. Mobile : formulaire
 * seul + lien de bascule.
 */
export function AuthShell({ defaultMode }: { defaultMode: Mode }) {
  const t = useTranslations("auth.panel");
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const [mode, setMode] = useState<Mode>(defaultMode);
  const isSignup = mode === "signup";

  const go = (m: Mode) => {
    setMode(m);
    if (typeof window !== "undefined") {
      const path = m === "signin" ? "/login" : "/register";
      const qs = next ? `?next=${encodeURIComponent(next)}` : "";
      window.history.replaceState(null, "", path + qs);
    }
  };

  return (
    <>
      {/* Fond plein écran : crème + formes décoratives (comme la réf) */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-[#FDF6EF]">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-orange/15 blur-2xl" />
        <div className="absolute -bottom-32 -left-24 size-96 rounded-full bg-[#F7B733]/20 blur-3xl" />
        <div className="absolute bottom-12 right-1/4 size-40 rounded-full bg-[#FF3D6E]/10 blur-2xl" />
      </div>

      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-30px_rgba(10,6,18,0.35)]">
        {/* ===== Desktop : 2/3 formulaire + 1/3 panneau, animé ===== */}
        <div className="relative hidden min-h-[560px] md:block">
          {/* Formulaire connexion — occupe 2/3 à gauche */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 flex w-2/3 items-center justify-center p-10 transition-opacity duration-500",
              isSignup ? "z-0 pointer-events-none opacity-0" : "z-10 opacity-100",
            )}
            aria-hidden={isSignup}
          >
            <SignInForm next={next} />
          </div>

          {/* Formulaire inscription — occupe 2/3 à droite */}
          <div
            className={cn(
              "absolute inset-y-0 right-0 flex w-2/3 items-center justify-center p-10 transition-opacity duration-500",
              isSignup ? "z-10 opacity-100" : "z-0 pointer-events-none opacity-0",
            )}
            aria-hidden={!isSignup}
          >
            <SignUpForm next={next} />
          </div>

          {/* Panneau noir (1/3) qui glisse d'un côté à l'autre */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 z-20 w-1/3 transition-transform duration-500 ease-in-out",
              isSignup ? "translate-x-0" : "translate-x-[200%]",
            )}
          >
            <OverlayPanel mode={mode} onSwitch={go} />
          </div>
        </div>

        {/* ===== Mobile : un formulaire + bascule ===== */}
        <div className="md:hidden">
          <div className="h-1.5 bg-accent" />
          <div className="flex flex-col items-center gap-4 px-6 py-9">
            <BrandRow />
            {isSignup ? <SignUpForm next={next} /> : <SignInForm next={next} />}
            <p className="pt-1 text-center text-sm text-muted">
              {isSignup ? t("signinTitle") : t("signupTitle")}{" "}
              <button
                type="button"
                onClick={() => go(isSignup ? "signin" : "signup")}
                className="font-semibold text-accent hover:underline"
              >
                {isSignup ? t("signinCta") : t("signupCta")}
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function OverlayPanel({
  mode,
  onSwitch,
}: {
  mode: Mode;
  onSwitch: (m: Mode) => void;
}) {
  const t = useTranslations("auth.panel");
  const isSignup = mode === "signup";

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink text-white">
      {/* Lueur orange + formes décoratives (touche noir + orange) */}
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/25 blur-2xl" />
      <div className="pointer-events-none absolute -left-10 bottom-8 size-28 rotate-12 rounded-3xl border border-white/10" />

      {/* Logo */}
      <div className="absolute start-7 top-7">
        <BrandRow light />
      </div>

      {/* Invite « Se connecter » (visible quand le form inscription est actif) */}
      <PanelContent
        show={isSignup}
        title={t("signinTitle")}
        text={t("signinText")}
        cta={t("signinCta")}
        onClick={() => onSwitch("signin")}
      />
      {/* Invite « Créer un compte » (visible quand le form connexion est actif) */}
      <PanelContent
        show={!isSignup}
        title={t("signupTitle")}
        text={t("signupText")}
        cta={t("signupCta")}
        onClick={() => onSwitch("signup")}
      />
    </div>
  );
}

function PanelContent({
  show,
  title,
  text,
  cta,
  onClick,
}: {
  show: boolean;
  title: string;
  text: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center transition-opacity duration-300",
        show ? "opacity-100 delay-200" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!show}
    >
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="max-w-[15rem] text-sm leading-relaxed text-white/70">
        {text}
      </p>
      <button
        type="button"
        onClick={onClick}
        className="rounded-full border-2 border-accent px-8 py-2.5 text-sm font-semibold uppercase tracking-wide text-accent transition hover:bg-accent hover:text-white active:scale-[0.98]"
      >
        {cta}
      </button>
    </div>
  );
}

/**
 * Logo Kreatly. Le carré play reste orange dans les 2 cas ; seul le wordmark
 * s'adapte : « Kreatly » noir sur fond clair, blanc sur fond sombre (`light`).
 * Le « .io » reste orange (mélange noir + orange).
 */
function BrandRow({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path
            d="M9 6.5 L18.5 12 L9 17.5 Z"
            fill="#fff"
            stroke="#fff"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        className={cn(
          "font-bold tracking-tight",
          light ? "text-white" : "text-foreground",
        )}
      >
        Kreatly<span className="text-accent">.io</span>
      </span>
    </span>
  );
}
