"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import {
  createTask,
  updateTaskStatus,
  updateTaskAssignee,
  updateTaskPriority,
  deleteTask,
} from "@/app/(app)/tasks/actions";
import type { Task, TaskStatus } from "@/lib/types";
import type { BrandMember } from "@/app/(app)/tasks/page";

const DRAG_MIME = "application/x-mohtawa-task-id";

const COLUMNS: { key: TaskStatus; labelKey: "columnTodo" | "columnInProgress" | "columnDone" }[] = [
  { key: "todo", labelKey: "columnTodo" },
  { key: "in_progress", labelKey: "columnInProgress" },
  { key: "done", labelKey: "columnDone" },
];

/**
 * Board Kanban "/tasks" (migration 0049) : tâches visibles par toute
 * l'équipe de la marque active, assignables, glissables entre 3 colonnes
 * de statut. Remplace le tiroir perso "Mes tâches" (migration 0048).
 */
export function TasksBoard({
  currentUserId,
  initialTasks,
  members,
}: {
  currentUserId: string;
  initialTasks: Task[];
  members: BrandMember[];
}) {
  const t = useTranslations("tasks");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [label, setLabel] = React.useState("");
  const [dragTaskId, setDragTaskId] = React.useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<TaskStatus | null>(null);

  const assigneeOptions = [
    { value: "", label: t("unassigned") },
    ...members.map((m) => ({
      value: m.user_id,
      label: m.user_id === currentUserId ? `${m.email} (${t("me")})` : m.email,
    })),
  ];

  const submit = () => {
    const value = label.trim();
    if (!value) return;
    setLabel("");
    startTransition(async () => {
      await createTask({ label: value });
      router.refresh();
    });
  };

  const moveTask = (taskId: string, status: TaskStatus) => {
    startTransition(async () => {
      await updateTaskStatus(taskId, status);
      router.refresh();
    });
  };

  const reassign = (taskId: string, assigneeId: string) => {
    startTransition(async () => {
      await updateTaskAssignee(taskId, assigneeId || null);
      router.refresh();
    });
  };

  const remove = (taskId: string) => {
    startTransition(async () => {
      await deleteTask(taskId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t("addPlaceholder")}
          autoComplete="off"
          className="h-11 flex-1 max-w-md rounded-full border border-border bg-card px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!label.trim() || pending}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
        >
          <Plus className="size-4" />
          {t("add")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = initialTasks.filter((task) => task.status === col.key);
          const isOver = dragOverCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverCol !== col.key) setDragOverCol(col.key);
              }}
              onDragLeave={() => {
                if (dragOverCol === col.key) setDragOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverCol(null);
                const taskId = e.dataTransfer.getData(DRAG_MIME);
                setDragTaskId(null);
                if (!taskId) return;
                moveTask(taskId, col.key);
              }}
              className={cn(
                "flex flex-col gap-2.5 rounded-2xl border border-border/60 bg-secondary/20 p-3 transition-colors",
                isOver && "border-accent/50 bg-accent/5",
              )}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {t(col.labelKey)}
                </span>
                <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-muted">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex min-h-16 flex-col gap-2">
                {colTasks.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted">
                    {t("emptyColumn")}
                  </p>
                )}
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      setDragTaskId(task.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData(DRAG_MIME, task.id);
                    }}
                    onDragEnd={() => setDragTaskId(null)}
                    className={cn(
                      "group flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-all cursor-grab active:cursor-grabbing",
                      dragTaskId === task.id && "opacity-40",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(async () => {
                            await updateTaskPriority(
                              task.id,
                              task.priority === "urgent" ? "normal" : "urgent",
                            );
                            router.refresh();
                          })
                        }
                        title={task.priority === "urgent" ? t("priorityUrgent") : t("priorityNormal")}
                        aria-label={task.priority === "urgent" ? t("priorityUrgent") : t("priorityNormal")}
                        className="mt-1 flex size-4 shrink-0 items-center justify-center"
                      >
                        <span
                          className={cn(
                            "size-2.5 rounded-full",
                            task.priority === "urgent" ? "bg-destructive" : "bg-amber-400",
                          )}
                        />
                      </button>
                      <p className="flex-1 text-sm leading-snug">{task.label}</p>
                      <button
                        type="button"
                        onClick={() => remove(task.id)}
                        aria-label={t("delete")}
                        className="rounded-full p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    {task.content_title && task.content_id && (
                      <Link
                        href={`/content/${task.content_id}`}
                        className="inline-block truncate text-xs text-accent hover:underline"
                      >
                        {task.content_title}
                      </Link>
                    )}

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <User className="size-3 shrink-0 text-muted" />
                      <Select
                        value={task.assignee_id ?? ""}
                        onValueChange={(v) => reassign(task.id, v)}
                        options={assigneeOptions}
                        className="h-7 rounded-full px-2.5 text-[11px]"
                        contentClassName="text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {members.length === 0 && (
        <p className="text-xs text-muted">{t("noMembersHint")}</p>
      )}
    </div>
  );
}
