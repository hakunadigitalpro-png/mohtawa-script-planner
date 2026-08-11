"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListChecks, Plus, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { createTask, toggleTask, deleteTask, updateTaskPriority } from "@/app/(app)/tasks/actions";
import type { PersonalTask, TaskPriority } from "@/lib/types";

/**
 * "Mes tâches" : bloc-notes perso façon Gmail Tasks — tiroir latéral avec un
 * champ d'ajout libre + une liste à cocher, triée statut > priorité > date.
 * PAS partagé avec l'équipe (contrairement à la Checklist par vidéo).
 * Auto-complété depuis les notifications via le bouton "+" sur chaque item
 * de la cloche (voir notifications-bell.tsx).
 */
export function TasksPanel({
  initialTasks,
  channelSuffix,
}: {
  initialTasks: PersonalTask[];
  /** Évite les id DOM dupliqués entre la version sidebar et mobile. */
  channelSuffix?: string;
}) {
  const t = useTranslations("tasks");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [label, setLabel] = React.useState("");

  const openCount = initialTasks.filter((task) => !task.done).length;

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = () => {
    const value = label.trim();
    if (!value) return;
    setLabel("");
    startTransition(async () => {
      await createTask({ label: value });
      router.refresh();
    });
  };

  const handleToggle = (task: PersonalTask) => {
    startTransition(async () => {
      await toggleTask(task.id, !task.done);
      router.refresh();
    });
  };

  const handleDelete = (task: PersonalTask) => {
    startTransition(async () => {
      await deleteTask(task.id);
      router.refresh();
    });
  };

  const handleCyclePriority = (task: PersonalTask) => {
    const next: TaskPriority = task.priority === "urgent" ? "normal" : "urgent";
    startTransition(async () => {
      await updateTaskPriority(task.id, next);
      router.refresh();
    });
  };

  const sorted = [...initialTasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
    return a.created_at.localeCompare(b.created_at);
  });

  const inputId = `tasks-add-input${channelSuffix ? `-${channelSuffix}` : ""}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("ariaLabel")}
        className={cn(
          "tooltip-trigger relative flex size-11 items-center justify-center rounded-full transition-all",
          open
            ? "bg-card text-foreground"
            : "bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground",
        )}
      >
        <ListChecks className="size-4.5" />
        {openCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground">
            {openCount > 9 ? "9+" : openCount}
          </span>
        )}
        <span className="tooltip-content">{t("tooltip")}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s border-border/60 bg-card shadow-[0_0_60px_-10px_rgba(10,6,18,0.25)]"
            role="dialog"
            aria-modal
          >
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <h2 className="text-base font-semibold">{t("title")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
              <input
                id={inputId}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder={t("addPlaceholder")}
                autoComplete="off"
                className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!label.trim() || pending}
                aria-label={t("add")}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {sorted.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {sorted.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      priorityLabel={
                        task.priority === "urgent" ? t("priorityUrgent") : t("priorityNormal")
                      }
                      deleteLabel={t("delete")}
                      onToggle={() => handleToggle(task)}
                      onDelete={() => handleDelete(task)}
                      onCyclePriority={() => handleCyclePriority(task)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function TaskRow({
  task,
  priorityLabel,
  deleteLabel,
  onToggle,
  onDelete,
  onCyclePriority,
}: {
  task: PersonalTask;
  priorityLabel: string;
  deleteLabel: string;
  onToggle: () => void;
  onDelete: () => void;
  onCyclePriority: () => void;
}) {
  return (
    <li
      className={cn(
        "group flex items-start gap-2.5 rounded-xl px-2 py-2 transition hover:bg-secondary/50",
        task.done && "opacity-60",
      )}
    >
      <Checkbox checked={task.done} onCheckedChange={onToggle} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug", task.done && "text-muted-foreground line-through")}>
          {task.label}
        </p>
        {task.content_title && task.content_id && (
          <Link
            href={`/content/${task.content_id}`}
            className="mt-0.5 inline-block truncate text-xs text-accent hover:underline"
          >
            {task.content_title}
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={onCyclePriority}
        title={priorityLabel}
        aria-label={priorityLabel}
        className="mt-1.5 flex size-4 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "size-2.5 rounded-full",
            task.priority === "urgent" ? "bg-destructive" : "bg-amber-400",
          )}
        />
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        className="mt-0.5 rounded-full p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
