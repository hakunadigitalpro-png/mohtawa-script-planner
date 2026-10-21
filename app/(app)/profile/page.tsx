import { getTranslations } from "next-intl/server";
import { getCachedUser } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LocaleSwitcherFull } from "@/components/locale-switcher";
import { getThemeFromCookies } from "@/lib/theme";
import { getCoachMode } from "@/lib/coach-pref";
import { CoachSwitch } from "./coach-switch";
import { PushToggle } from "@/components/push-toggle";
import { PageHeader } from "@/components/page-header";
import { getMyPlan } from "@/lib/plans";

export default async function ProfilePage() {
  const user = await getCachedUser();
  if (!user) return null;

  const t = await getTranslations("profile");
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const [{ theme, accent, tint }, coachMode] = await Promise.all([
    getThemeFromCookies(),
    getCoachMode(),
  ]);

  const plan = await getMyPlan();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>Mon plan</CardTitle>
            <CardDescription>
              Pour changer, prolonger ou activer l&apos;IA, contacte Mariam.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Plan</span>
              <span className="font-medium text-foreground">
                {plan.plan_label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Statut</span>
              <span className="font-medium text-foreground">
                {plan.status === "trial" && "Essai"}
                {plan.status === "active" && "Actif"}
                {plan.status === "readonly" && "Lecture seule"}
                {plan.status === "suspended" && "Suspendu"}
              </span>
            </div>
            {plan.ends_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Fin d&apos;accès</span>
                <span className="font-medium text-foreground">
                  {new Date(plan.ends_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted">IA</span>
              <span className="font-medium text-foreground">
                {plan.ai_enabled ? "Activée" : "Désactivée"}
              </span>
            </div>
            <a
              href="https://wa.me/21629555090"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-2"
            >
              Contacter Mariam
            </a>
          </CardContent>
        </Card>
      )}

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

      <CoachSwitch initialMode={coachMode} />

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
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Un rappel chaque matin pour les contenus programmés aujourd&apos;hui.
            À activer sur chaque appareil où tu veux les recevoir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushToggle
            publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
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
