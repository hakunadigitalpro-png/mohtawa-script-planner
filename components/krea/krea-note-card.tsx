import Link from "next/link";
import { cn } from "@/lib/utils";
import type { KreaNote } from "@/lib/krea-notes";
import { KreaFloatingIcon } from "./krea-floating-icon";

/**
 * Krea qui commente un chiffre. Elle apparaît là où il y a des nombres —
 * tableau de bord, statistiques — pour dire ce qu'ils VEULENT DIRE et ce
 * qu'il y a à faire ensuite.
 *
 * Une note par page, jamais deux : la voix d'une coach perd tout son poids
 * si elle commente chaque bloc.
 *
 * Le geste proposé (`action`) est un lien au bout de la phrase, dans la
 * colonne de texte — pas une pastille à droite, qui à 400 px écraserait la
 * phrase sur cinq lignes. En orange parce que c'est une action ; la carte
 * « push » n'est qu'une teinte, pas un second orange.
 */
export function KreaNoteCard({
  note,
  className,
}: {
  note: KreaNote | null;
  className?: string;
}) {
  if (!note) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-3xl border px-4 py-3",
        note.tone === "win"
          ? "border-emerald-300/50 bg-emerald-50/60"
          : note.tone === "push"
            ? "border-accent/25 bg-accent/5"
            : "border-border bg-secondary/40",
        className,
      )}
    >
      <KreaFloatingIcon size={44} className="shrink-0" />
      <p className="text-sm leading-relaxed text-foreground" dir="auto">
        {note.text}
        {note.action && (
          <Link
            href={note.action.href}
            className="ms-1 whitespace-nowrap font-semibold text-accent underline-offset-4 hover:underline"
          >
            {note.action.label} →
          </Link>
        )}
      </p>
    </div>
  );
}
