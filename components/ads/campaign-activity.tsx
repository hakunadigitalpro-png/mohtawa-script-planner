import { AD_STATUS_LABEL } from "@/lib/types-ads";

export type CampaignActivityRow = {
  id: string;
  field: "status" | "review" | "dates" | "title" | "budget" | "lead";
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  /** Null : c'est Kreatly (passage automatique selon les dates). */
  actor_label: string | null;
};

const WHAT: Record<CampaignActivityRow["field"], string> = {
  status: "a changé le statut",
  review: "a changé la validation",
  dates: "a changé la période",
  title: "a changé le titre",
  budget: "a changé le budget",
  lead: "a changé le responsable",
};

const REVIEW_LABEL: Record<string, string> = {
  pending_review: "Envoyée au client",
  approved: "Validée par le client",
  needs_revision: "Modifications demandées",
};

function show(row: CampaignActivityRow, value: string | null): string {
  if (!value) return "Aucun";
  if (row.field === "status") {
    return AD_STATUS_LABEL[value as keyof typeof AD_STATUS_LABEL] ?? value;
  }
  if (row.field === "review") return REVIEW_LABEL[value] ?? value;
  if (row.field === "dates") {
    return value
      .split(" → ")
      .map((d) =>
        new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      )
      .join(" → ");
  }
  return value;
}

/** Qui a changé quoi sur la campagne, le plus récent en haut. Réservé à l'équipe. */
export function CampaignActivity({ rows }: { rows: CampaignActivityRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-3xl border border-foreground/10 bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Historique</h3>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="text-sm">
            <p className="text-foreground/80">
              <span className="font-semibold text-foreground">{r.actor_label ?? "Kreatly"}</span>{" "}
              {WHAT[r.field]}
            </p>
            <p className="mt-0.5 text-foreground" dir="auto">
              <span className="text-muted-foreground line-through">{show(r, r.old_value)}</span>
              {" → "}
              {show(r, r.new_value)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
