import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getThemeFromCookies } from "@/lib/theme";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const { theme, accent, tint } = await getThemeFromCookies();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mon profil</h1>
        <p className="text-sm text-muted">
          Modifie ton nom, ta langue et l&apos;apparence.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>Ton compte sur Mohtawa.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            email={user.email ?? ""}
            fullName={meta.full_name ?? ""}
            language={meta.language ?? "fr"}
          />
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
          <CardTitle>Session</CardTitle>
          <CardDescription>Connecté avec {user.email}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold hover:bg-secondary"
            >
              Se déconnecter
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
