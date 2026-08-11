"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskPriority } from "@/lib/types";

/**
 * Crée une tâche perso ("Mes tâches", migration 0048). `contentId`/
 * `contentTitle` optionnels : renseignés quand la tâche vient d'un clic
 * "Ajouter à mes tâches" sur une notification.
 */
export async function createTask(input: {
  label: string;
  priority?: TaskPriority;
  contentId?: string | null;
  contentTitle?: string | null;
}) {
  const label = input.label.trim();
  if (!label) return { error: "Le libellé est requis." };

  const supabase = await createClient();
  const { error } = await supabase.from("personal_tasks").insert({
    label,
    priority: input.priority ?? "normal",
    content_id: input.contentId ?? null,
    content_title: input.contentTitle ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function toggleTask(taskId: string, done: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("personal_tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function updateTaskPriority(taskId: string, priority: TaskPriority) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("personal_tasks")
    .update({ priority })
    .eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("personal_tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}
