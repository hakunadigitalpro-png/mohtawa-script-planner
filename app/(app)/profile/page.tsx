import { getTranslations } from "next-intl/server";
import { getCachedUser } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LocaleSwitcherFull } from "@/components/locale-switcher";
import { getThemeFromCookies } from "@/lib/theme";

export default async function ProfilePage() {
  const user = await getCachedUser();
  if (!user) return null;

  const t = await getTranslations("profile");
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const { theme, accent, tint } = await getThemeFromCookies();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("infoTitle")}</CardTitle>
          <CardDescription>{t("infoSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            email={user.email ?? ""}
            fullName={meta.full_name ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("language")}</CardTitle>
          <CardDescription>{t("languageHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LocaleSwitcherFull />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>
            Personnalise ton interface : mode clair / sombre ou tes propres couleurs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitcher
            initialTheme={theme}
            initialAccent={accent}
            initialTint={tint}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sessionTitle")}</CardTitle>
          <CardDescription>{t("sessionSubtitle", { email: user.email ?? "" })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold hover:bg-secondary"
            >
              {t("signout")}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
