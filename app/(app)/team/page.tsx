import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";

/**
 * Page Équipe GLOBALE : une seule vue de qui a accès à quoi, à travers
 * TOUTES mes marques. Évite d'avoir à ouvrir chaque fiche marque pour
 * voir ou retirer un accès.
 *
 * V1 : regroupe par personne, montre une pastille par marque où elle a
 * un accès (rôle en tag coloré). Clic sur une pastille → amène à la
 * fiche équipe de cette marque, où le détail (scopes, expiration,
 * retrait) est déjà en place.
 */
type Row = {
  brand_id: string;
  brand_name: string;
  user_id: string;
  email: string;
  role: string;
  expires_at: string | null;
};

// Fonds colorés mais clairs, texte toujours en noir (foreground forcé) :
// Mariam a demandé l'écriture en noir et des pastilles pas trop grandes.
const ROLE_TONE: Record<string, string> = {
  owner: "bg-foreground/10 !text-foreground",
  admin: "bg-violet-100 !text-foreground dark:bg-violet-500/20",
  editor: "bg-sky-100 !text-foreground dark:bg-sky-500/20",
  viewer: "bg-amber-100 !text-foreground dark:bg-amber-500/20",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Client",
};

export default async function TeamPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect("/login");

  // Mes marques où je suis owner ou admin : seules celles-ci peuvent
  // être gérées depuis cette page.
  const { data: myMemberships } = await supabase
    .from("brand_members")
    .select("brand_id, role, brands(id, name)")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"]);

  type MyRow = {
    brand_id: string;
    role: string;
    brands: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  const myBrands = ((myMemberships ?? []) as MyRow[])
    .map((r) => {
      const b = Array.isArray(r.brands) ? r.brands[0] : r.brands;
      return b ? { id: b.id, name: b.name } : null;
    })
    .filter((b): b is { id: string; name: string } => b !== null);

  if (myBrands.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Équipe"
          subtitle="Vois qui a accès à quoi sur l'ensemble de tes marques."
        />
        <div className="rounded-3xl border border-dashed border-foreground/15 bg-card p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Tu n&apos;as encore aucune marque dont tu es owner ou admin.
          </p>
        </div>
      </div>
    );
  }

  // Tous les membres de ces marques, en un seul round-trip via la vue.
  const brandIds = myBrands.map((b) => b.id);
  const { data: rowsData } = await supabase
    .from("brand_members_with_emails")
    .select("brand_id, user_id, email, role, expires_at")
    .in("brand_id", brandIds)
    .order("email", { ascending: true });

  const rows = ((rowsData ?? []) as (Omit<Row, "brand_name"> & {
    brand_id: string;
  })[]).map((r) => ({
    ...r,
    brand_name: myBrands.find((b) => b.id === r.brand_id)?.name ?? "—",
  })) as Row[];

  // Groupage par personne.
  type Person = {
    user_id: string;
    email: string;
    isMe: boolean;
    memberships: {
      brand_id: string;
      brand_name: string;
      role: string;
      expires_at: string | null;
    }[];
  };
  const byUser = new Map<string, Person>();
  for (const r of rows) {
    let p = byUser.get(r.user_id);
    if (!p) {
      p = {
        user_id: r.user_id,
        email: r.email,
        isMe: r.user_id === user.id,
        memberships: [],
      };
      byUser.set(r.user_id, p);
    }
    p.memberships.push({
      brand_id: r.brand_id,
      brand_name: r.brand_name,
      role: r.role,
      expires_at: r.expires_at,
    });
  }
  // Tri : moi en premier, puis par email.
  const people = [...byUser.values()].sort((a, b) => {
    if (a.isMe) return -1;
    if (b.isMe) return 1;
    return a.email.localeCompare(b.email);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe"
        subtitle={`${people.length} personne${people.length > 1 ? "s" : ""} sur tes ${myBrands.length} marque${myBrands.length > 1 ? "s" : ""}. Clique un badge pour gérer les accès détaillés.`}
      />

      <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-card">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[minmax(240px,2fr)_minmax(0,3fr)] gap-3 border-b border-foreground/10 bg-foreground/[0.03] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Personne</div>
            <div>Accès par marque</div>
          </div>
          {people.map((p) => (
            <div
              key={p.user_id}
              className="grid grid-cols-[minmax(240px,2fr)_minmax(0,3fr)] gap-3 border-b border-foreground/5 px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">
                  {p.email}
                  {p.isMe && (
                    <span className="ms-2 text-xs text-muted-foreground">(toi)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.memberships.length} marque{p.memberships.length > 1 ? "s" : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.memberships.map((m) => {
                  const expired =
                    m.expires_at &&
                    new Date(m.expires_at).getTime() < Date.now();
                  return (
                    <Link
                      key={m.brand_id}
                      href={`/brands/${m.brand_id}#team`}
                      title={
                        expired
                          ? `${m.brand_name} — expiré`
                          : `${m.brand_name} — ${ROLE_LABEL[m.role] ?? m.role}`
                      }
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight transition hover:ring-1 hover:ring-accent/40 ${
                        expired
                          ? "bg-rose-100 !text-foreground line-through dark:bg-rose-500/20"
                          : ROLE_TONE[m.role] ?? "bg-foreground/5 !text-foreground"
                      }`}
                    >
                      <span className="truncate max-w-[160px]">
                        {m.brand_name}
                      </span>
                      <span className="opacity-60">
                        · {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Pour inviter quelqu&apos;un sur une marque, ouvre sa fiche
        marque et clique « Créer un lien d&apos;invitation ».
      </p>
    </div>
  );
}
