import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveActiveBrand } from "@/lib/brand";
import { HooksLibrary } from "@/components/hooks-library";
import { PageHeader } from "@/components/page-header";

export default async function HooksPage() {
  const { role } = await resolveActiveBrand();
  // Un "viewer" (client invité) est cantonné au Calendrier.
  if (role === "viewer") redirect("/calendar");

  const t = await getTranslations("hooks");
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <HooksLibrary />
    </div>
  );
}
