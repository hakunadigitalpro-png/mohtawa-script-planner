"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, FileText, PenLine, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { askKrea, type KreaDeed } from "@/app/(app)/krea-actions";

type Msg = {
  role: "krea" | "me";
  text: string;
  deeds?: KreaDeed[];
};

/** Nom lisible de la page courante — Krea s'en sert pour ne pas demander où on est. */
function pageLabel(pathname: string): string {
  if (pathname.startsWith("/content/")) return "la fiche d'un contenu";
  if (pathname.startsWith("/brands/")) return "la page d'une marque";
  if (pathname.startsWith("/calendar")) return "le calendrier";
  if (pathname.startsWith("/dashboard")) return "le tableau de bord";
  if (pathname.startsWith("/analytics")) return "les statistiques";
  if (pathname.startsWith("/tasks")) return "le tableau des tâches";
  if (pathname.startsWith("/hooks")) return "la bibliothèque d'accroches";
  if (pathname.startsWith("/brands")) return "la liste des marques";
  if (pathname.startsWith("/profile")) return "son profil";
  return "l'application";
}

function openContentId(pathname: string): string | null {
  const m = pathname.match(/^\/content\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

const SUGGESTIONS = [
  "Je veux faire un reel",
  "Je ne sais pas quoi publier cette semaine",
  "C'est quoi la prochaine chose à faire ?",
];

export function KreaCopilot() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Le fil vit chez Google : on ne renvoie que cet identifiant, pas tout
  // l'historique. C'est ce qui garde le coût d'un tour à peu près constant.
  const threadRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs, pending]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || pending) return;
    setDraft("");
    setError(null);
    setMsgs((m) => [...m, { role: "me", text: clean }]);

    startTransition(async () => {
      const res = await askKrea({
        message: clean,
        interactionId: threadRef.current,
        page: pageLabel(pathname),
        openContentId: openContentId(pathname),
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }
      threadRef.current = res.interactionId;
      setMsgs((m) => [
        ...m,
        { role: "krea", text: res.message, deeds: res.deeds },
      ]);

      // Krea a demandé une navigation : on la fait, et le panneau reste
      // ouvert pour qu'elle puisse enchaîner.
      const nav = res.deeds.find((d) => d.kind === "navigate");
      if (nav && nav.kind === "navigate") router.push(nav.href);
      else if (res.deeds.length) router.refresh();
    });
  };

  return (
    <>
      {/* Pastille flottante — présente sur toutes les pages de l'app. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer Krea" : "Ouvrir Krea, ta coach"}
        className={cn(
          "fixed bottom-5 end-5 z-40 inline-flex items-center gap-2 rounded-full py-2 pe-4 ps-2 shadow-lift transition hover:scale-105",
          open ? "bg-ink text-white" : "bg-accent text-white",
        )}
      >
        {open ? (
          <X className="mx-1 size-5" />
        ) : (
          <Image
            src="/mascot/krea-avatar.png"
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
          />
        )}
        <span className="text-sm font-bold">Krea</span>
      </button>

      {open && (
        <div className="surface-glass fixed bottom-20 end-5 z-40 flex max-h-[min(34rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl shadow-lift">
          <div className="surface-board flex items-center gap-2 px-4 py-3">
            <Image
              src="/mascot/krea-avatar.png"
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Krea</p>
              <p className="truncate text-[11px] text-white/70">
                Ta coach — dis-lui quoi faire, elle le fait
              </p>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-card/60 p-3"
          >
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="px-1 text-sm text-muted">
                  Tu ne sais pas par où commencer ? Dis-le-moi avec tes mots.
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-start text-sm text-foreground transition hover:border-accent/50 hover:bg-secondary"
                  >
                    <Sparkles className="size-3.5 shrink-0 text-accent" />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  m.role === "me"
                    ? "ms-auto bg-accent text-white"
                    : "bg-card text-foreground shadow-soft",
                )}
                dir="auto"
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                {m.deeds?.map((d, j) => <DeedCard key={j} deed={d} />)}
              </div>
            ))}

            {pending && (
              <div className="flex items-center gap-1.5 px-1 text-sm text-muted">
                <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-accent" />
              </div>
            )}

            {error && (
              <p
                className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-border/60 bg-card p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              dir="auto"
              placeholder="Dis-moi ce que tu veux faire…"
              className="max-h-24 min-h-9 flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground [field-sizing:content] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-label="Envoyer"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent/90 disabled:opacity-40"
            >
              <ArrowUp className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/** Ce que Krea a RÉELLEMENT fait, montré comme une carte cliquable — pas
 *  seulement affirmé dans le texte. */
function DeedCard({ deed }: { deed: KreaDeed }) {
  if (deed.kind === "content_created") {
    return (
      <Link
        href={`/content/${deed.id}`}
        className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent/50"
      >
        <FileText className="size-3.5 shrink-0 text-accent" />
        <span className="truncate">{deed.title}</span>
      </Link>
    );
  }
  if (deed.kind === "script_written") {
    return (
      <Link
        href={`/content/${deed.id}`}
        className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent/50"
      >
        <PenLine className="size-3.5 shrink-0 text-accent" />
        Script écrit — ouvrir
      </Link>
    );
  }
  return null;
}
