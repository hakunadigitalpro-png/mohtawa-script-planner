import { cn } from "@/lib/utils";

/**
 * Identité de marque **Kreatly** — source unique du logo dans tout le projet.
 *
 *  - <LogoMark>     : le "bouton play" (triangle blanc sur carré orange accent).
 *  - <LogoWordmark> : le wordmark « Kreatly.io » (le « .io » en accent).
 *  - <Logo>         : mark + wordmark côte à côte.
 *
 * Le carré utilise `bg-accent` (il suit donc le thème de la marque active) et le
 * triangle `text-accent-foreground` (blanc) — cohérent en clair, sombre et
 * thème personnalisé. Un seul endroit à toucher pour faire évoluer le logo.
 */
export function LogoMark({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className={cn("size-1/2", iconClassName)}
        aria-hidden
      >
        {/* Même triangle que app/icon.svg → logo, favicon et icône PWA identiques. */}
        <path
          d="M9 6.5 L18.5 12 L9 17.5 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight text-foreground", className)}>
      Kreatly<span className="text-accent">.io</span>
    </span>
  );
}

export function Logo({
  className,
  markClassName,
  iconClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark
        className={cn("size-8 rounded-xl", markClassName)}
        iconClassName={iconClassName}
      />
      <LogoWordmark className={wordmarkClassName} />
    </span>
  );
}
