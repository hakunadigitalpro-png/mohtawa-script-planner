"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import type { TaskPriority, TaskStatus } from "@/lib/types";

/**
 * Crée une tâche sur le board de la marque active (migration 0049).
 * `contentId`/`contentTitle` optionnels : renseignés quand la tâche vient
 * d'un clic "Ajouter à mes tâches" sur une notification. `assigneeId` non
 * fourni = tâche non assignée (reste "à moi" tant que personne ne se
 * l'attribue).
 */
export async function createTask(input: {
  label: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  contentId?: string | null;
  contentTitle?: string | null;
}) {
  const label = input.label.trim();
  if (!label) return { error: "Le libellé est requis." };

  const supabase = await createClient();
  const { active } = await resolveActiveBrand();
  const { error } = await supabase.from("tasks").insert({
    label,
    priority: input.priority ?? "normal",
    assignee_id: input.assigneeId ?? null,
    brand_id: active?.id ?? null,
    content_id: input.contentId ?? null,
    content_title: input.contentTitle ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status, done_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function updateTaskAssignee(taskId: string, assigneeId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ assignee_id: assigneeId })
    .eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function updateTaskPriority(taskId: string, priority: TaskPriority) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ priority })
    .eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}
