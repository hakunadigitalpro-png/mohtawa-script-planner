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
      <KreaFloatingIcon
        size={44}
        // Elle félicite ou elle relance : son mouvement le dit avant le texte.
        mood={note.tone === "win" ? "win" : note.tone === "push" ? "push" : "idle"}
        className="shrink-0"
      />
      <p className="text-sm leading-relaxed text-foreground" dir="auto">
        {note.text}
      </p>
    </div>
  );
}
