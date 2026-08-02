"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";

type Mode = "signin" | "signup";

/**
 * Carte d'authentification style « Diprella » : deux formulaires (connexion /
 * inscription) côte à côte, recouverts par un panneau orange qui glisse pour
 * basculer de l'un à l'autre. Sur mobile, un seul formulaire + lien de bascule.
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
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-[#FF6B35]/15 blur-2xl" />
        <div className="absolute -bottom-32 -left-24 size-96 rounded-full bg-[#F7B733]/20 blur-3xl" />
        <div className="absolute bottom-12 right-1/4 size-40 rounded-full bg-[#FF3D6E]/10 blur-2xl" />
      </div>

      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-30px_rgba(10,6,18,0.35)]">
        {/* ===== Desktop : split animé ===== */}
        <div className="relative hidden min-h-[560px] md:block">
          {/* Formulaire connexion — moitié gauche */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 flex w-1/2 items-center justify-center p-10 transition-opacity duration-500",
              isSignup ? "pointer-events-none opacity-0" : "opacity-100",
            )}
            aria-hidden={isSignup}
          >
            <SignInForm next={next} />
          </div>

          {/* Formulaire inscription — moitié droite */}
          <div
            className={cn(
              "absolute inset-y-0 right-0 flex w-1/2 items-center justify-center p-10 transition-opacity duration-500",
              isSignup ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={!isSignup}
          >
            <SignUpForm next={next} />
          </div>

          {/* Overlay orange qui glisse par-dessus une moitié */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 z-20 w-1/2 transition-transform duration-500 ease-in-out",
              isSignup ? "translate-x-0" : "translate-x-full",
            )}
          >
            <OverlayPanel mode={mode} onSwitch={go} />
          </div>
        </div>

        {/* ===== Mobile : un formulaire + bascule ===== */}
        <div className="md:hidden">
          <div className="relative h-2 bg-gradient-to-r from-[#FF8A4C] to-[#F0560F]" />
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
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#FF8A4C] to-[#F0560F] text-white">
      {/* Logo */}
      <div className="absolute start-8 top-7">
        <BrandRow light />
      </div>

      {/* Formes décoratives */}
      <div className="pointer-events-none absolute -right-12 top-1/3 size-44 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -left-8 bottom-10 size-24 rotate-12 rounded-3xl bg-white/10" />

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
        "absolute inset-0 flex flex-col items-center justify-center gap-5 px-12 text-center transition-opacity duration-300",
        show ? "opacity-100 delay-200" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!show}
    >
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-white/85">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className="rounded-full border-2 border-white/80 px-9 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10 active:scale-[0.98]"
      >
        {cta}
      </button>
    </div>
  );
}

/** Logo Kreatly (carré play + wordmark). `light` = version blanche sur orange. */
function BrandRow({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg",
          light ? "bg-white/20" : "bg-accent",
        )}
      >
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
        Kreatly
        <span className={light ? "text-white/70" : "text-accent"}>.io</span>
      </span>
    </span>
  );
}
