import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Building2, LayoutGrid } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { resolveActiveBrand } from "@/lib/brand";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { MyTasksList, type MyTaskGroup } from "@/components/tasks/my-tasks-list";
import { ViewTab, ViewTabs } from "@/components/ui/view-tabs";
import { PageHeader } from "@/components/page-header";
import type { Task } from "@/lib/types";

export type BrandMember = {
  user_id: string;
  email: string;
  role: string;
};

type TaskWithBrand = Task & {
  brands: { name: string } | { name: string }[] | null;
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const { active, role } = await resolveActiveBrand();
  if (!active) redirect("/dashboard");
  // Garde par scope (0082) : si l'owner a coché « Tâches » pour ce
  // membre, il entre ; sinon il repart sur le calendrier.
  const { data: canSee } = await supabase.rpc("has_brand_scope", {
    b: active.id,
    s: "tasks",
  });
  if (!canSee) redirect(role === "viewer" ? "/review" : "/calendar");

  const params = await searchParams;
  const allBrands = params.all === "1";
  const t = await getTranslations("tasks");

  const tabs = (
    <ViewTabs>
      <ViewTab
        href="/tasks"
        active={!allBrands}
        icon={<LayoutGrid className="size-4 shrink-0 max-sm:hidden" aria-hidden />}
      >
        {t("tabThisBrand")}
      </ViewTab>
      <ViewTab
        href="/tasks?all=1"
        active={allBrands}
        icon={<Building2 className="size-4 shrink-0 max-sm:hidden" aria-hidden />}
      >
        {t("tabAllBrands")}
      </ViewTab>
    </ViewTabs>
  );

  if (allBrands) {
    // Ce qui m'est assigné et pas fait, sur toutes mes marques : la policy
    // `tasks_select` (0049) laisse un membre lire les tâches de toutes ses
    // marques — il manquait seulement l'écran. Groupé par marque, dans un
    // ordre fixe, pour que la liste ne se rebatte pas après un « Fait ».
    const { data } = await supabase
      .from("tasks")
      .select("*, brands(name)")
      .eq("assignee_id", user.id)
      .neq("status", "done")
      .order("created_at", { ascending: true });

    const byBrand = new Map<string, MyTaskGroup>();
    for (const row of (data ?? []) as TaskWithBrand[]) {
      const rel = row.brands;
      const name =
        (Array.isArray(rel) ? rel[0]?.name : rel?.name)?.trim() || "—";
      const key = row.brand_id ?? "none";
      const group = byBrand.get(key) ?? { brandId: key, brandName: name, tasks: [] };
      const { brands: _brands, ...task } = row;
      void _brands;
      group.tasks.push(task as Task);
      byBrand.set(key, group);
    }
    const groups = [...byBrand.values()].sort((a, b) =>
      a.brandName.localeCompare(b.brandName, "fr"),
    );

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("allEyebrow")}
          title={t("title")}
          subtitle={t("allSubtitle")}
          actionsClassName="w-full"
          actions={tabs}
        />
        <MyTasksList groups={groups} />
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={active.name}
        title={t("title")}
        subtitle={t("subtitle", { brand: active.name })}
        actionsClassName="w-full"
        actions={tabs}
      />
      <div data-tour="tasks-board">
      <TasksBoard
        currentUserId={user.id}
        initialTasks={tasks}
        members={members}
      />
      </div>
    </div>
  );
}
