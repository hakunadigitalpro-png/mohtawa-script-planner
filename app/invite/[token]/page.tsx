import Link from "next/link";
import { Users, Crown, Shield, Pencil, Eye, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDateFr } from "@/lib/utils";
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

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
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
              {t("validUntil", { date: formatDateFr(new Date(preview.expires_at)) })}
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
