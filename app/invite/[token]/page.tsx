import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Crown, Shield, Pencil, Eye, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDateFr, isFarFuture } from "@/lib/utils";
import { AcceptInviteForm } from "./accept-form";

export const dynamic = "force-dynamic";

type ErrorReason = "invalid_token" | "not_found" | "already_used" | "expired";

type Preview =
  | {
      brand_id: string;
      brand_name: string;
      role: "owner" | "admin" | "editor" | "viewer";
      inviter: string;
      expires_at: string;
      note: string | null;
    }
  | { error: ErrorReason };

/** Créé il y a moins d'une heure : c'est pour cette invitation qu'il existe. */
function isFreshAccount(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 60 * 60 * 1000;
}

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { token } = await params;
  const { welcome } = await searchParams;
  const supabase = await createClient();

  // Récupère la session courante (peut être null = non connecté)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Le RPC est SECURITY DEFINER mais demande grant authenticated → si non-auth
  // on doit gérer le cas "pas connecté" en proposant login/register.
  if (!user) {
    return <UnauthedView token={token} />;
  }

  const { data, error } = await supabase.rpc("get_invitation_preview", {
    p_token: token,
  });

  const preview = (error ? { error: "invalid_token" } : (data as Preview)) as Preview;

  if ("error" in preview) {
    return <ErrorView reason={preview.error} />;
  }

  // Un compte créé POUR cette invitation (`welcome=1`, posé par l'inscription
  // ou la confirmation d'e-mail) la rejoint sans qu'on lui redemande : il
  // vient de donner son nom et son mot de passe pour ça. Quelqu'un qui a déjà
  // un compte, lui, voit la marque et le rôle, et clique — accepter reste un
  // acte conscient quand on n'a pas créé son compte pour ça. La bascule de
  // marque passe par la porte du chantier 2 : un rendu ne pose pas de cookie.
  // `welcome=1` est dans l'URL, donc copiable : on ne le croit que pour un
  // compte qui vient d'être créé (moins d'une heure). Un compte ancien qui
  // tombe dessus voit la page normale et clique.
  if (welcome === "1" && isFreshAccount(user.created_at)) {
    const { error: acceptError } = await supabase.rpc("accept_brand_invitation", {
      p_token: token,
    });
    if (!acceptError) {
      redirect(
        `/switch-brand?to=${preview.brand_id}&next=${encodeURIComponent("/dashboard")}`,
      );
    }
    // Sinon (déjà membre, lien consommé entre-temps…) : la page normale, avec
    // le bouton, et son message d'erreur s'il y a lieu.
  }

  const t = await getTranslations("invite");
  const tRoles = await getTranslations("team.roles");
  const RoleIcon = ROLE_ICON[preview.role] ?? Users;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent/10">
            <Users className="size-7 text-accent" />
          </div>
          <CardTitle className="text-center text-2xl">
            {t("headerTitle")}
          </CardTitle>
          <CardDescription className="text-center">
            {t.rich("headerSubtitle", {
              inviter: preview.inviter,
              brand: preview.brand_name,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-wide text-muted">
                {t("yourRole")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold">
                <RoleIcon className="size-3" />
                {tRoles(preview.role)}
              </span>
            </div>
            {preview.note && (
              <p className="mt-3 border-t border-border/60 pt-3 text-sm italic text-muted">
                « {preview.note} »
              </p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Clock className="size-3" />
              {isFarFuture(preview.expires_at)
                ? t("noExpiration")
                : t("validUntil", { date: formatDateFr(new Date(preview.expires_at)) })}
            </p>
          </div>

          <AcceptInviteForm token={token} brandId={preview.brand_id} />

          <p className="text-center text-xs text-muted">
            {t("connectedAs", { email: user.email ?? "" })}{" "}
            <form action="/auth/signout" method="post" className="inline">
              <button type="submit" className="underline hover:text-foreground">
                {t("switchAccount")}
              </button>
            </form>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

async function UnauthedView({ token }: { token: string }) {
  const t = await getTranslations("invite");
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent/10">
            <Users className="size-7 text-accent" />
          </div>
          <CardTitle className="text-center text-2xl">
            {t("unauthTitle")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("unauthSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link
            href={`/register?next=${next}`}
            className={buttonVariants({ className: "w-full" })}
          >
            {t("createAccount")}
          </Link>
          <Link
            href={`/login?next=${next}`}
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {t("haveAccount")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

async function ErrorView({ reason }: { reason: ErrorReason }) {
  const t = await getTranslations("invite");
  const title = t(`errors.${reason}.title`);
  const description = t(`errors.${reason}.description`);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center">{title}</CardTitle>
          <CardDescription className="text-center">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {t("backToDashboard")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
