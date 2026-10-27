"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Target,
  BarChart2,
  Send,
  Trash2,
  Check,
  X,
  Plus,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { AdSetsEditor } from "@/components/ads/ad-sets-editor";
import {
  type AdCampaign,
  type AdCampaignMedia,
  type AdCampaignMediaKind,
  type AdCampaignStatus,
  AD_STATUS_LABEL,
  AD_STATUS_PICKER,
  AD_OBJECTIVES,
  AD_PLATFORMS,
} from "@/lib/types-ads";
import { Select } from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  updateCampaignField,
  deleteAdCampaign,
  addCampaignMedia,
  removeCampaignMedia,
  submitAdCampaignForReview,
  clientReviewAdCampaign,
  addCampaignComment,
} from "@/app/(app)/ads/actions";

/**
 * Éditeur d'une campagne. Trois blocs qui se remplissent dans l'ordre, comme
 * le modèle Notion de DIMPO :
 *   1. Proposition — ce qu'on montre au client
 *   2. Suivi       — statut Kreatly + validation client
 *   3. Résultats   — chiffres, captures de stats, analyse, évaluation
 *
 * Autosave sur blur (plus simple à raisonner qu'un debounce par champ, et
 * suffisant pour un formulaire qui n'est pas tapé en continu comme un
 * script). Le fil de remarques est en bas et sert aussi au client via
 * la soumission à validation.
 */

type CommentView = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_email: string;
};

export function AdCampaignEditor({
  campaign,
  media: initialMedia,
  comments,
  currentUserId,
  isWriter,
  hasClient,
  visualCount,
  brandId,
  adSets,
}: {
  campaign: AdCampaign;
  media: AdCampaignMedia[];
  comments: CommentView[];
  currentUserId: string;
  isWriter: boolean;
  hasClient: boolean;
  visualCount: number;
  brandId: string;
  adSets: (import("@/lib/types-ads").AdSet & {
    ads: (import("@/lib/types-ads").Ad & {
      slides: import("@/lib/types-ads").AdSlide[];
    })[];
  })[];
}) {
  const router = useRouter();
  const [local, setLocal] = React.useState<AdCampaign>(campaign);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [justSaved, setJustSaved] = React.useState(false);
  const [sending, setSending] = React.useState<"submit" | "approve" | "revise" | null>(
    null,
  );

  React.useEffect(() => setLocal(campaign), [campaign]);

  // Petit « Enregistré ✓ » pendant 1,2 s après chaque save réussi, pour
  // qu'une action rapide (toggle plateforme) ne reste pas silencieuse.
  React.useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1200);
    return () => clearTimeout(t);
  }, [justSaved]);

  // Autosave sur blur : on compare l'ancienne et la nouvelle valeur, et on
  // envoie seulement ce qui a changé. Les champs numériques renvoient null
  // quand on vide la case (pour l'UI, « rien saisi » ≠ « zéro »).
  async function flush(patch: Partial<AdCampaign>, label: string) {
    setSaving(label);
    const { error } = await updateCampaignField(campaign.id, patch as never);
    setSaving(null);
    if (error) alert(error);
    else {
      setJustSaved(true);
      router.refresh();
    }
  }

  function togglePlatform(p: string) {
    const next = local.platforms.includes(p)
      ? local.platforms.filter((x) => x !== p)
      : [...local.platforms, p];
    setLocal({ ...local, platforms: next });
    flush({ platforms: next }, "platforms");
  }

  async function handleDelete() {
    if (!confirm("Supprimer cette campagne ?")) return;
    const { error } = await deleteAdCampaign(campaign.id);
    if (error) alert(error);
    else router.push("/ads");
  }

  async function handleSubmitForReview() {
    setSending("submit");
    const { error } = await submitAdCampaignForReview(campaign.id);
    setSending(null);
    if (error) alert(error);
    else router.refresh();
  }

  async function handleClientReview(decision: "approve" | "revise") {
    const comment =
      decision === "revise"
        ? prompt("Qu'est-ce qui doit être retravaillé ?") ?? undefined
        : undefined;
    setSending(decision);
    const { error } = await clientReviewAdCampaign(
      campaign.id,
      decision,
      comment,
    );
    setSending(null);
    if (error) alert(error);
    else router.refresh();
  }

  // Garde côté client, identique à `whyNotSendable` pour les contenus :
  // il faut un client ET un visuel. Bloqué, le bouton devient une
  // pastille-instruction qui dit quoi faire — pas un bouton grisé muet.
  const blocker: { msg: string; href: string | null } | null = !hasClient
    ? {
        msg: "Invite d'abord ton client",
        href: `/brands/${brandId}#team`,
      }
    : visualCount === 0
      ? { msg: "Ajoute au moins un visuel", href: null }
      : null;

  const canSubmit =
    isWriter && local.review_state !== "pending_review" && !blocker;

  const isPendingForMe =
    !isWriter && local.review_state === "pending_review";

  // Fil de remarques repliable, pour donner toute la place aux textes
  // des ads. L'état est mémorisé en localStorage pour que la préférence
  // tienne entre les visites — ferme une fois, elle reste fermée.
  const [commentsOpen, setCommentsOpen] = React.useState(true);
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("kreatly_ad_comments_open");
      if (saved === "0") setCommentsOpen(false);
    } catch {
      /* localStorage indisponible : on reste par défaut ouvert */
    }
  }, []);
  const toggleComments = () => {
    setCommentsOpen((v) => {
      try {
        localStorage.setItem("kreatly_ad_comments_open", v ? "0" : "1");
      } catch {
        /* idem */
      }
      return !v;
    });
  };

  return (
    <div
      className={`grid gap-6 ${
        commentsOpen
          ? "lg:grid-cols-[minmax(0,1fr)_320px]"
          : "lg:grid-cols-1"
      }`}
    >
      <div className="space-y-6">
        {/* En-tête : statut + validation + actions ============== */}
        <section className="rounded-3xl border border-foreground/10 bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusMenu
              value={local.status}
              disabled={!isWriter}
              onChange={(s) => {
                setLocal({ ...local, status: s });
                flush({ status: s }, "status");
              }}
            />
            <ReviewBadge state={local.review_state} />
            {saving ? (
              <span className="text-xs text-muted-foreground">Enregistrement…</span>
            ) : justSaved ? (
              <span className="text-xs text-emerald-700 dark:text-emerald-300">
                Enregistré ✓
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              {isWriter ? (
                <>
                  {blocker && local.review_state !== "pending_review" ? (
                    blocker.href ? (
                      <Link
                        href={blocker.href}
                        className="rounded-full border border-dashed border-foreground/20 bg-foreground/5 px-3 py-1 text-xs text-foreground/80 transition hover:border-accent/40"
                      >
                        {blocker.msg}
                      </Link>
                    ) : (
                      <span className="rounded-full border border-dashed border-foreground/20 bg-foreground/5 px-3 py-1 text-xs text-foreground/80">
                        {blocker.msg}
                      </span>
                    )
                  ) : (
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={!canSubmit || sending === "submit"}
                      onClick={handleSubmitForReview}
                    >
                      <Send className="h-4 w-4" />
                      {local.review_state === "pending_review"
                        ? "En attente du client"
                        : sending === "submit"
                          ? "Envoi…"
                          : "Soumettre au client"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    aria-label="Supprimer la campagne"
                    title="Supprimer la campagne"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              {isPendingForMe ? (
                <>
                  <Button
                    size="sm"
                    variant="accent"
                    disabled={sending !== null}
                    onClick={() => handleClientReview("approve")}
                  >
                    <Check className="h-4 w-4" />
                    {sending === "approve" ? "Enregistrement…" : "Valider"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sending !== null}
                    onClick={() => handleClientReview("revise")}
                  >
                    <X className="h-4 w-4" />
                    Demander une modif
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </section>

        {/* 1. Proposition ========================================= */}
        <section className="space-y-4 rounded-3xl border border-foreground/10 bg-card p-5">
          <SectionTitle icon={Megaphone} title="Proposition" subtitle="Ce que tu montres au client avant de lancer" />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Titre">
              <Input
                value={local.title}
                onChange={(e) => setLocal({ ...local, title: e.target.value })}
                onBlur={() =>
                  local.title !== campaign.title &&
                  flush({ title: local.title }, "title")
                }
                disabled={!isWriter}
              />
            </Field>
            <Field label="Thématique">
              <Input
                placeholder="Ex. Loi 25, Webinaire, Notoriété…"
                value={local.theme ?? ""}
                onChange={(e) => setLocal({ ...local, theme: e.target.value })}
                onBlur={() => flush({ theme: local.theme }, "theme")}
                disabled={!isWriter}
              />
            </Field>
            <Field label="Date de début">
              <DateTimePicker
                date={local.date_start ?? ""}
                time=""
                showTime={false}
                disabled={!isWriter}
                placeholder="Choisir une date"
                onChange={({ date }) => {
                  const next = date || null;
                  setLocal({ ...local, date_start: next });
                  flush({ date_start: next }, "date_start");
                }}
              />
            </Field>
            <Field label="Date de fin">
              <DateTimePicker
                date={local.date_end ?? ""}
                time=""
                showTime={false}
                disabled={!isWriter}
                placeholder="Choisir une date"
                onChange={({ date }) => {
                  const next = date || null;
                  setLocal({ ...local, date_end: next });
                  flush({ date_end: next }, "date_end");
                }}
              />
            </Field>
            <Field label="Budget global" hint="Ex. 500 TND">
              <Input
                value={local.budget_global ?? ""}
                onChange={(e) =>
                  setLocal({ ...local, budget_global: e.target.value || null })
                }
                onBlur={() =>
                  flush({ budget_global: local.budget_global }, "budget_global")
                }
                disabled={!isWriter}
              />
            </Field>
            {/* Le budget journalier vit maintenant sur l'ad set (0064). */}
          </div>

          {/* Rollup budget : somme des budget_daily × durée en jours vs
              budget global saisi. Donne en un coup d'œil « j'ai alloué
              X sur mes Y de budget ». Pas de calcul si l'un des deux
              bouts manque. */}
          <BudgetRollup
            budgetGlobal={local.budget_global}
            dateStart={local.date_start}
            dateEnd={local.date_end}
            adSets={adSets}
          />

          <Field label="Plateformes">
            <div className="flex flex-wrap gap-2">
              {AD_PLATFORMS.map((p) => {
                const on = local.platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    disabled={!isWriter}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      on
                        ? "bg-foreground text-background"
                        : "bg-foreground/5 text-foreground hover:bg-foreground/10"
                    } ${isWriter ? "" : "opacity-60"}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Objectif de la campagne" hint="Les six verbes officiels des régies (Meta, LinkedIn)">
            <Select
              value={local.objective ?? ""}
              disabled={!isWriter}
              onValueChange={(v) => {
                const next = v || null;
                setLocal({ ...local, objective: next });
                flush({ objective: next }, "objective");
              }}
              options={[
                { value: "", label: "— Pas encore choisi —" },
                ...AD_OBJECTIVES,
              ]}
            />
          </Field>

          {/* Le texte principal vit maintenant sur chaque ad (champ Hook).
              La colonne `post_text` reste en base pour les anciennes
              campagnes mais n'est plus éditable d'ici. */}

          {/* Ciblage et visuels vivent maintenant au niveau de l'ad set
              (migration 0064). Les colonnes `targeting_*` restent en base
              pour les anciennes campagnes et sont utilisées comme valeurs
              par défaut quand on crée un premier ad set (addAdSet). */}
        </section>

        {/* 2 bis. Ad sets + Ads (0064) ============================= */}
        <section className="space-y-4 rounded-3xl border border-foreground/10 bg-card p-5">
          <AdSetsEditor
            campaignId={campaign.id}
            adSets={adSets}
            canEdit={isWriter}
          />
        </section>

        {/* 3. Résultats ============================================ */}
        <section className="space-y-4 rounded-3xl border border-foreground/10 bg-card p-5">
          <SectionTitle icon={BarChart2} title="Résultats" subtitle="Rempli une fois la campagne diffusée" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <NumberField
              label="Portée"
              value={local.reach}
              onChange={(v) => setLocal({ ...local, reach: v })}
              onBlur={() => flush({ reach: local.reach }, "reach")}
              disabled={!isWriter}
            />
            <NumberField
              label="Clics"
              value={local.clicks}
              onChange={(v) => setLocal({ ...local, clicks: v })}
              onBlur={() => flush({ clicks: local.clicks }, "clicks")}
              disabled={!isWriter}
            />
            <NumberField
              label="Prospects"
              value={local.leads}
              onChange={(v) => setLocal({ ...local, leads: v })}
              onBlur={() => flush({ leads: local.leads }, "leads")}
              disabled={!isWriter}
            />
            <NumberField
              label="Emails"
              value={local.emails}
              onChange={(v) => setLocal({ ...local, emails: v })}
              onBlur={() => flush({ emails: local.emails }, "emails")}
              disabled={!isWriter}
            />
            <NumberField
              label="Essais gratuits"
              value={local.essays}
              onChange={(v) => setLocal({ ...local, essays: v })}
              onBlur={() => flush({ essays: local.essays }, "essays")}
              disabled={!isWriter}
            />
          </div>

          <MediaGrid
            label="Captures de stats"
            kind="stats"
            campaignId={campaign.id}
            media={initialMedia}
            canEdit={isWriter}
          />

          <Field label="Analyse" hint="Ce qui a bien marché, ce qu'on reconduit">
            <Textarea
              rows={5}
              value={local.analysis ?? ""}
              onChange={(e) =>
                setLocal({ ...local, analysis: e.target.value || null })
              }
              onBlur={() => flush({ analysis: local.analysis }, "analysis")}
              disabled={!isWriter}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Évaluation">
              <div className="flex flex-wrap gap-2">
                {(["poor", "average", "good"] as const).map((e) => {
                  const on = local.evaluation === e;
                  const label =
                    e === "poor" ? "Faible" : e === "average" ? "Moyenne" : "Bonne";
                  return (
                    <button
                      key={e}
                      type="button"
                      disabled={!isWriter}
                      onClick={() => {
                        const next = on ? null : e;
                        setLocal({ ...local, evaluation: next });
                        flush({ evaluation: next }, "evaluation");
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        on
                          ? e === "good"
                            ? "bg-emerald-500 text-white"
                            : e === "average"
                              ? "bg-amber-500 text-white"
                              : "bg-rose-500 text-white"
                          : "bg-foreground/5 text-foreground hover:bg-foreground/10"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Lien de la pub en ligne">
              <Input
                type="url"
                placeholder="https://facebook.com/..."
                value={local.live_url ?? ""}
                onChange={(e) =>
                  setLocal({ ...local, live_url: e.target.value || null })
                }
                onBlur={() => flush({ live_url: local.live_url }, "live_url")}
                disabled={!isWriter}
              />
            </Field>
          </div>
        </section>
      </div>

      {/* Colonne latérale : fil de remarques, repliable ================= */}
      {commentsOpen ? (
        <aside className="space-y-3">
          <section className="rounded-3xl border border-foreground/10 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquare className="h-4 w-4" />
                  Fil de remarques
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  L&apos;équipe et le client y échangent sur la campagne.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleComments}
                title="Masquer le fil"
                aria-label="Masquer le fil de remarques"
                className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CommentThread
              campaignId={campaign.id}
              comments={comments}
              currentUserId={currentUserId}
            />
          </section>
        </aside>
      ) : null}

      {/* Bouton flottant pour ré-ouvrir le fil quand il est masqué. */}
      {!commentsOpen && (
        <button
          type="button"
          onClick={toggleComments}
          title="Afficher le fil de remarques"
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-lg transition hover:brightness-110"
        >
          <MessageSquare className="h-4 w-4" />
          Fil de remarques
          {comments.length > 0 && (
            <span className="rounded-full bg-black/15 px-1.5 text-xs">
              {comments.length}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

// ======================================================================
// Sous-composants
// ======================================================================

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-foreground/10 pb-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-foreground/5 text-foreground/70">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </header>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/80">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onBlur,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/80">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === "" ? null : Number(raw));
        }}
        onBlur={onBlur}
        disabled={disabled}
      />
    </div>
  );
}

function StatusMenu({
  value,
  disabled,
  onChange,
}: {
  value: AdCampaignStatus;
  disabled?: boolean;
  onChange: (s: AdCampaignStatus) => void;
}) {
  // On s'assure que la valeur courante est toujours visible dans le
  // menu, même si c'est un ancien 'scheduled' qui n'est plus proposé.
  const options = (
    AD_STATUS_PICKER.includes(value)
      ? AD_STATUS_PICKER
      : [...AD_STATUS_PICKER, value]
  ).map((s) => ({ value: s, label: AD_STATUS_LABEL[s] }));

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(v) => onChange(v as AdCampaignStatus)}
      options={options}
      className="w-36"
    />
  );
}

function ReviewBadge({ state }: { state: AdCampaign["review_state"] }) {
  if (!state) return null;
  if (state === "pending_review")
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
        En attente du client
      </span>
    );
  if (state === "approved")
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200">
        Validée par le client
      </span>
    );
  return (
    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-900 dark:bg-rose-500/20 dark:text-rose-200">
      À retravailler
    </span>
  );
}

function MediaGrid({
  label,
  kind,
  campaignId,
  media,
  canEdit,
  hint,
}: {
  label: string;
  kind: AdCampaignMediaKind;
  campaignId: string;
  media: AdCampaignMedia[];
  canEdit: boolean;
  hint?: string;
}) {
  const router = useRouter();
  const items = media.filter((m) => m.kind === kind);
  const [pendingUrl, setPendingUrl] = React.useState<string | null>(null);

  async function commit(url: string | null) {
    if (!url) return;
    const { error } = await addCampaignMedia(campaignId, kind, url);
    setPendingUrl(null);
    if (error) alert(error);
    else router.refresh();
  }

  async function remove(id: string) {
    const { error } = await removeCampaignMedia(id, campaignId);
    if (error) alert(error);
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-foreground/80">{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {items.map((m) => (
          <div
            key={m.id}
            className="group relative overflow-hidden rounded-xl border border-foreground/10 bg-background"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.image_url}
              alt=""
              className="h-40 w-full object-cover"
            />
            {canEdit ? (
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-background/90 opacity-0 shadow transition group-hover:opacity-100"
                aria-label="Retirer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
        {canEdit ? (
          <ImageUpload
            folder={`ad/${campaignId}`}
            value={pendingUrl}
            onChange={commit}
            aspectRatio="square"
            label={items.length === 0 ? "Ajouter" : "Ajouter un visuel"}
            hint={null}
            frameClassName="h-40"
          />
        ) : null}
        {!canEdit && items.length === 0 ? (
          <p className="col-span-full text-xs text-muted-foreground">
            Rien à montrer pour l&apos;instant.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CommentThread({
  campaignId,
  comments,
  currentUserId,
}: {
  campaignId: string;
  comments: CommentView[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await addCampaignComment(campaignId, text);
    setSending(false);
    if (error) {
      alert(error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-3">
      <ul className="max-h-[400px] space-y-2 overflow-auto">
        {comments.length === 0 ? (
          <li className="text-xs text-muted-foreground">Pas encore de remarque.</li>
        ) : (
          comments.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-foreground/5 bg-background p-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {c.user_id === currentUserId ? "Toi" : c.author_email}
                </span>
                <span className="text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{c.body}</p>
            </li>
          ))
        )}
      </ul>
      <div className="space-y-2">
        <Textarea
          rows={2}
          placeholder="Ta remarque…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button
          size="sm"
          variant="accent"
          onClick={send}
          disabled={sending || !body.trim()}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          Envoyer
        </Button>
      </div>
    </div>
  );
}

/**
 * Encart « où en est le budget » posé sous les dates et le budget
 * global. Reprend le motif Airtable des rollups : somme des budget_daily
 * des ad sets × durée de la campagne, comparée au budget global saisi.
 * Pas d'alerte si une donnée manque : on n'invente rien.
 */
function BudgetRollup({
  budgetGlobal,
  dateStart,
  dateEnd,
  adSets,
}: {
  budgetGlobal: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  adSets: { budget_daily: string | null }[];
}) {
  const toNumber = (v: string | null): number | null => {
    if (!v) return null;
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const dailySum = adSets.reduce((sum, s) => sum + (toNumber(s.budget_daily) ?? 0), 0);
  if (dailySum === 0) return null;

  const days =
    dateStart && dateEnd
      ? Math.max(
          1,
          Math.round(
            (new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86400_000,
          ) + 1,
        )
      : null;
  const allocated = days !== null ? dailySum * days : null;
  const global = toNumber(budgetGlobal);
  const diff = global !== null && allocated !== null ? global - allocated : null;

  const toneDiff =
    diff === null
      ? "text-muted"
      : diff < 0
        ? "text-rose-600 font-semibold"
        : "text-emerald-600";

  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          <span className="text-muted">Alloué par les ad sets : </span>
          <span className="font-medium text-foreground">
            {dailySum.toLocaleString("fr-FR")} /j
          </span>
          {days !== null && (
            <span className="text-muted">
              {" "}
              × {days} j = <span className="font-medium text-foreground">
                {allocated!.toLocaleString("fr-FR")}
              </span>
            </span>
          )}
        </span>
        {global !== null && allocated !== null && (
          <span className={toneDiff}>
            {diff! < 0
              ? `Dépassement : ${(-diff!).toLocaleString("fr-FR")}`
              : `Reste : ${diff!.toLocaleString("fr-FR")}`}
          </span>
        )}
      </div>
    </div>
  );
}
