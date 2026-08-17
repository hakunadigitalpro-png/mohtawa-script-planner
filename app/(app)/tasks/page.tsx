import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { TasksBoard } from "@/components/tasks/tasks-board";
import type { Task } from "@/lib/types";

export type BrandMember = {
  user_id: string;
  email: string;
  role: string;
};

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active, role } = await resolveActiveBrand();
  // Un "viewer" (client invité) est cantonné au Calendrier — même
  // traitement que Dashboard/Analytics/Hooks/Brands.
  if (role === "viewer") redirect("/calendar");
  if (!active) redirect("/dashboard");

  const [tasksRes, membersRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("brand_id", active.id)
      .order("created_at", { ascending: true }),
    supabase.rpc("list_brand_members_with_emails", { p_brand_id: active.id }),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];
  const members = (membersRes.data ?? []) as BrandMember[];

  const t = await getTranslations("tasks");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle", { brand: active.name })}</p>
      </div>
      <TasksBoard
        currentUserId={user.id}
        initialTasks={tasks}
        members={members}
      />
    </div>
  );
}
