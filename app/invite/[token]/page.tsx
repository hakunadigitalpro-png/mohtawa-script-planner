import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Crown, Shield, Pencil, Eye, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDateFr } from "@/lib/utils";
import { AcceptInviteForm } from "./accept-form";

export const dynamic = "force-dynamic";

type Preview =
  | {
      brand_id: string;
      brand_name: string;
      role: "owner" | "admin" | "editor" | "viewer";
      inviter: string;
      expires_at: string;
      note: string | null;
    }
  | { error: "invalid_token" | "not_found" | "already_used" | "expired" };

const ROLE_LABEL: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  editor: "Éditeur",
  viewer: "Lecteur",
};

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
    return (
      <UnauthedView token={token} />
    );
  }

  const { data, error } = await supabase.rpc("get_invitation_preview", {
    p_token: token,
  });

  const preview = (error ? { error: "invalid_token" } : (data as Preview)) as Preview;

  if ("error" in preview) {
    return <ErrorView reason={preview.error} />;
  }

  const RoleIcon = ROLE_ICON[preview.role] ?? Users;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent/10">
            <Users className="size-7 text-accent" />
          </div>
          <CardTitle className="text-center text-2xl">
            Tu as été invité sur Mohtawa
          </CardTitle>
          <CardDescription className="text-center">
            <strong>{preview.inviter}</strong> t&apos;invite à rejoindre la marque{" "}
            <strong>{preview.brand_name}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-wide text-muted">
                Ton rôle
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold">
                <RoleIcon className="size-3" />
                {ROLE_LABEL[preview.role] ?? preview.role}
              </span>
            </div>
            {preview.note && (
              <p className="mt-3 border-t border-border/60 pt-3 text-sm italic text-muted">
                « {preview.note} »
              </p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Clock className="size-3" />
              Valide jusqu&apos;au {formatDateFr(new Date(preview.expires_at))}
            </p>
          </div>

          <AcceptInviteForm token={token} brandId={preview.brand_id} />

          <p className="text-center text-xs text-muted">
            Connecté en tant que <strong>{user.email}</strong>.{" "}
            <form action="/auth/signout" method="post" className="inline">
              <button type="submit" className="underline hover:text-foreground">
                Changer de compte
              </button>
            </form>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function UnauthedView({ token }: { token: string }) {
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent/10">
            <Users className="size-7 text-accent" />
          </div>
          <CardTitle className="text-center text-2xl">
            Une invitation t&apos;attend
          </CardTitle>
          <CardDescription className="text-center">
            Connecte-toi ou crée un compte pour accepter cette invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link
            href={`/register?next=${next}`}
            className={buttonVariants({ className: "w-full" })}
          >
            Créer un compte
          </Link>
          <Link
            href={`/login?next=${next}`}
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            J&apos;ai déjà un compte
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorView({
  reason,
}: {
  reason: "invalid_token" | "not_found" | "already_used" | "expired";
}) {
  const messages: Record<typeof reason, { title: string; description: string }> = {
    invalid_token: {
      title: "Lien invalide",
      description: "Ce lien d'invitation n'est pas valide. Vérifie que tu l'as copié en entier.",
    },
    not_found: {
      title: "Lien introuvable",
      description: "Cette invitation n'existe pas. Demande à la personne qui t'a invité de te générer un nouveau lien.",
    },
    already_used: {
      title: "Invitation déjà acceptée",
      description: "Ce lien a déjà été utilisé. Si tu es déjà membre, va directement sur ton tableau de bord.",
    },
    expired: {
      title: "Invitation expirée",
      description: "Ce lien a dépassé sa date de validité (30 jours). Demande un nouveau lien.",
    },
  };

  const m = messages[reason];

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center">{m.title}</CardTitle>
          <CardDescription className="text-center">{m.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            Aller à mon tableau de bord
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
