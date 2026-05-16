import { getTranslations } from "next-intl/server";
import { HooksLibrary } from "@/components/hooks-library";

export default async function HooksPage() {
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
