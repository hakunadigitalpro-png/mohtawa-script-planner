import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/lib/types";

/**
 * Le point de priorité d'une tâche — défini une fois, pour le tableau et
 * pour la liste « Toutes mes marques ». Aucun jeton n'existe pour la
 * priorité : la couleur n'a pas à s'écrire deux fois.
 */
export function TaskPriorityDot({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "size-2.5 rounded-full",
        priority === "urgent" ? "bg-destructive" : "bg-amber-400",
        className,
      )}
    />
  );
}
