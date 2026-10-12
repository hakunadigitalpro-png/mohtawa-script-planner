"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateTaskStatus } from "@/app/(app)/tasks/actions";
import { TaskPriorityDot } from "./task-priority-dot";
import type { Task } from "@/lib/types";

export type MyTaskGroup = { brandId: string; brandName: string; tasks: Task[] };

/**
 * « Toutes mes marques » : ce qui m'est assigné et pas fait, partout, en une
 * liste groupée par marque. Pas de glisser-déposer, pas d'assignation — le
 * tableau de chaque marque reste l'endroit où l'on organise ; ici, on fait.
 *
 * Une ligne = trois blocs : l'urgence (seulement si urgent — quinze points
 * jaunes décoratifs ne diraient rien), le libellé qui se replie avec le lien
 * du contenu dessous, et « Fait ». Le bouton est `outline` : un contrôle
 * répété par ligne n'est pas l'action de la page. L'attente est PAR ligne :
 * un `pending` partagé par dix lignes ferait clignoter les neuf autres.
 */
export function MyTasksList({ groups }: { groups: MyTaskGroup[] }) {
  const t = useTranslations("tasks");
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const markDone = (taskId: string) => {
    setBusyId(taskId);
    startTransition(async () => {
      await updateTaskStatus(taskId, "done");
      router.refresh();
    });
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted">
        <p className="font-medium text-foreground">{t("emptyAllTitle")}</p>
        <p className="mt-1">{t("emptyAllSubtitle")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.brandId} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              {group.brandName}
            </h2>
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold text-muted">
              {group.tasks.length}
            </span>
          </div>
          <ul className="space-y-2">
            {group.tasks.map((task) => {
              const busy = busyId === task.id;
              return (
                <li
                  key={task.id}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm"
                >
                  {task.priority === "urgent" && (
                    <span className="mt-1.5 flex shrink-0 items-center">
                      <TaskPriorityDot priority="urgent" />
                      <span className="sr-only">{t("urgent")}</span>
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug" dir="auto">
                      {task.label}
                    </p>
                    {task.content_title && task.content_id && (
                      <Link
                        href={`/content/${task.content_id}`}
                        className="mt-0.5 block truncate text-xs text-accent hover:underline"
                        dir="auto"
                      >
                        {task.content_title}
                      </Link>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => markDone(task.id)}
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-3.5" aria-hidden />
                    )}
                    {t("markDone")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
