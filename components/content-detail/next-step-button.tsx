"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarCheck,
  Check,
  Clock,
  ExternalLink,
  Globe,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { platformsForType } from "@/lib/constants";
import { nextStep, primaryPublication } from "@/lib/content-lifecycle";
import { submitForReview } from "@/app/(app)/review/actions";
import { advanceContent } from "@/app/(app)/contents/lifecycle-actions";
import type { ContentPublication } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Le bouton qui suit le contenu, dans l'en-tête de la fiche. Un seul, dont
 * l'étiquette change avec le statut : « Envoyer au client », puis « C'est
 * programmé », puis « C'est en ligne ». C'est le moteur
 * (`lib/content-lifecycle.ts`) qui dit laquelle ; ici on ne fait qu'afficher
 * et appeler.
 *
 * Il remplace l'ancien `SubmitReviewButton`, qui ne couvrait que le premier
 * geste et laissait les deux autres au menu Statut du Plan — cinq clics, et
 * un passage en ligne qu'on oubliait.
 *
 * Le seul élément orange de la rangée : c'est l'action principale. Les états
 * passifs (« Chez le client », « En ligne ») restent des pastilles neutres.
 * Une erreur s'écrit en texte, sur sa propre ligne — une infobulle n'existe
 * pas sur un téléphone.
 */
export function NextStepButton({
  contentId,
  status,
  type,
  publications,
  today,
}: {
  contentId: string;
  status: string;
  type: string | null;
  publications: ContentPublication[];
  /** `YYYY-MM-DD` calculé par le serveur : une seule notion d'aujourd'hui. */
  today: string;
}) {
  const t = useTranslations("lifecycle");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<"program" | "live" | null>(null);

  const primary = primaryPublication(publications);
  const step = nextStep({
    status,
    type,
    publicationDate: primary?.scheduled_date ?? null,
    today,
    url: primary?.url ?? null,
  });

  const run = (fn: () => Promise<Result>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  // `basis-full` : sa propre ligne sous les pastilles, dans la rangée
  // `flex-wrap` de l'en-tête. Couleur explicite : le bandeau est sombre.
  const errorLine = error ? (
    <p role="alert" className="basis-full text-xs font-medium text-white/85">
      {error}
    </p>
  ) : null;

  const pill = (icon: React.ReactNode, label: string) => (
    <span
      data-tour="content-review"
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold text-muted"
    >
      {icon}
      {label}
    </span>
  );

  if (step.kind === "waiting_client") {
    return pill(<Clock className="size-3.5" />, t("waitingClient"));
  }
  if (step.kind === "needs_format") {
    return pill(<Globe className="size-3.5" />, t("needsFormat"));
  }
  if (step.kind === "online") {
    if (!step.url) return pill(<Check className="size-3.5" />, t("online"));
    return (
      <a
        href={step.url}
        target="_blank"
        rel="noopener noreferrer"
        data-tour="content-review"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <ExternalLink className="size-3.5" />
        {t("seeOnline")}
      </a>
    );
  }

  if (step.kind === "send_to_client") {
    return (
      <>
        <Button
          type="button"
          variant="accent"
          size="sm"
          data-tour="content-review"
          disabled={pending}
          aria-busy={pending}
          onClick={() => run(() => submitForReview(contentId))}
        >
          <Send className="size-3.5" />
          {pending ? t("sending") : error ? t("retry") : t("sendToClient")}
        </Button>
        {errorLine}
      </>
    );
  }

  if (step.kind === "mark_programmed") {
    return (
      <>
        <Button
          type="button"
          variant="accent"
          size="sm"
          data-tour="content-review"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            step.needsDate
              ? setDialog("program")
              : run(() => advanceContent({ contentId, step: "mark_programmed" }))
          }
        >
          <CalendarCheck className="size-3.5" />
          {pending ? t("saving") : t("markProgrammed")}
        </Button>
        {errorLine}
        {dialog === "program" && (
          <ProgramDialog
            contentId={contentId}
            type={type}
            needsPlatform={publications.length === 0}
            today={today}
            onClose={() => setDialog(null)}
          />
        )}
      </>
    );
  }

  // mark_live
  return (
    <>
      <Button
        type="button"
        variant="accent"
        size="sm"
        data-tour="content-review"
        disabled={pending}
        aria-busy={pending}
        onClick={() => setDialog("live")}
      >
        <Globe className="size-3.5" />
        {t("markLive")}
      </Button>
      {errorLine}
      {dialog === "live" && (
        <LiveDialog
          contentId={contentId}
          type={type}
          needsPlatform={publications.length === 0}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

/**
 * « Pour quand ? » — seulement quand aucune date n'existe. Trois champs au
 * plus : la plateforme si aucune publication, la date, l'heure.
 */
function ProgramDialog({
  contentId,
  type,
  needsPlatform,
  today,
  onClose,
}: {
  contentId: string;
  type: string | null;
  needsPlatform: boolean;
  today: string;
  onClose: () => void;
}) {
  const t = useTranslations("lifecycle");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const platforms = platformsForType(type);
  const [platform, setPlatform] = React.useState<string>(
    platforms[0]?.value ?? "",
  );
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [tried, setTried] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const past = Boolean(date) && date < today;
  const missing = !date;
  const showProblem = past || (tried && missing);

  const submit = () => {
    setTried(true);
    if (past || missing) return;
    setError(null);
    startTransition(async () => {
      const res = await advanceContent({
        contentId,
        step: "mark_programmed",
        platform: needsPlatform ? platform : null,
        date,
        time: time || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("program.title")}</DialogTitle>
          <DialogDescription>{t("program.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {needsPlatform && (
            <div className="space-y-2">
              <Label htmlFor="next-step-platform">{t("program.platform")}</Label>
              <Select
                id="next-step-platform"
                value={platform}
                onValueChange={setPlatform}
                options={platforms}
                placeholder="—"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="next-step-date">{t("program.date")}</Label>
              <Input
                id="next-step-date"
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={showProblem || undefined}
                autoFocus={!needsPlatform}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-step-time">{t("program.time")}</Label>
              <Input
                id="next-step-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          {/* L'aide sous le champ, pas sous le bouton : le pied de boîte est
              une rangée de boutons, un texte y flotterait et se casserait à
              400 px. Elle dit la règle avant, et le problème dès qu'il y en a un. */}
          <p
            role={showProblem ? "alert" : undefined}
            className={cn(
              "text-xs",
              showProblem ? "font-medium text-destructive" : "text-muted",
            )}
          >
            {past
              ? t("program.datePast")
              : tried && missing
                ? t("program.dateMissing")
                : t("program.dateHelp")}
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={submit}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? t("saving") : t("markProgrammed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * « Tu as le lien ? » — un champ facultatif. Si le contenu n'a jamais été
 * planifié (aucune publication), on demande d'abord où il est sorti : pas
 * d'échec silencieux.
 */
function LiveDialog({
  contentId,
  type,
  needsPlatform,
  onClose,
}: {
  contentId: string;
  type: string | null;
  needsPlatform: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("lifecycle");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const platforms = platformsForType(type);
  const [platform, setPlatform] = React.useState<string>(
    platforms[0]?.value ?? "",
  );
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await advanceContent({
        contentId,
        step: "mark_live",
        platform: needsPlatform ? platform : null,
        url: url || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("live.title")}</DialogTitle>
          <DialogDescription>{t("live.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {needsPlatform && (
            <div className="space-y-2">
              <Label htmlFor="next-step-live-platform">{t("live.where")}</Label>
              <Select
                id="next-step-live-platform"
                value={platform}
                onValueChange={setPlatform}
                options={platforms}
                placeholder="—"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="next-step-url">{t("live.url")}</Label>
            <Input
              id="next-step-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/…"
              autoFocus={!needsPlatform}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={submit}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? t("saving") : t("markLive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
