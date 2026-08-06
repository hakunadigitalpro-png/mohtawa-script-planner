import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveActiveBrand } from "@/lib/brand";
import { HooksLibrary } from "@/components/hooks-library";

export default async function HooksPage() {
  const { role } = await resolveActiveBrand();
  // Un "viewer" (client invité) est cantonné au Calendrier.
  if (role === "viewer") redirect("/calendar");

  const t = await getTranslations("hooks");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>

      <HooksLibrary />
    </div>
  );
}
