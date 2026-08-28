"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, FileText, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { askKrea, type KreaDeed } from "@/app/(app)/krea-actions";
import type { KreaTurn } from "@/lib/krea";
import {
  guideForPath,
  isSeen,
  markSeen,
  seenServerSnapshot,
  seenSnapshot,
  subscribeSeen,
  type GuidePage,
} from "@/lib/krea-guide";

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
  "Je ne sais pas quoi publier",
  "C'est quoi la prochaine étape ?",
];

/**
 * Krea détourée, en lévitation. Pas de cadre, pas de pastille ronde : le
 * personnage flotte et son ombre reste au sol. C'est `.krea-float`
 * (globals.css) qui porte l'animation — et qui la coupe si le système
 * demande des animations réduites.
 */
export function KreaFloatingIcon({
  size,
  className,
  priority,
}: {
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("krea-float", className)} style={{ width: size }}>
      <Image
        src="/mascot/krea-avatar.png"
        alt="Krea"
        width={size}
        height={size}
        priority={priority}
        className="block h-auto w-full"
      />
    </span>
  );
}

export function KreaCopilot({ firstName }: { firstName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // L'API Claude est sans mémoire : le fil doit repartir à chaque appel. On
  // garde donc le texte des tours ici (le serveur ne renvoie que les 10
  // derniers au modèle) — la plomberie des outils, elle, ne sort pas du tour.
  const threadRef = useRef<KreaTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [hovered, setHovered] = useState(false);
  // Accueil : Krea explique CHAQUE page la première fois qu'on y arrive, puis
  // se tait. Une visite guidée qui raconte tout d'un coup, hors contexte, ne
  // laisse rien — c'était le reproche fait à la précédente.
  const guide = guideForPath(pathname);
  const seen = useSyncExternalStore(
    subscribeSeen,
    seenSnapshot,
    seenServerSnapshot,
  );
  const guiding = Boolean(guide) && !open && !isSeen(seen, guide!.id);

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
        history: threadRef.current,
        page: pageLabel(pathname),
        openContentId: openContentId(pathname),
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Les identifiants créés sont rappelés dans le fil : sans ça, un
      // « maintenant écris le script » au tour suivant n'aurait plus de cible.
      const created = res.deeds
        .filter((d) => d.kind === "content_created")
        .map((d) =>
          d.kind === "content_created"
            ? ` [contenu créé : ${d.title}, identifiant ${d.id}]`
            : "",
        )
        .join("");
      threadRef.current = [
        ...threadRef.current,
        { role: "user", content: clean },
        { role: "assistant", content: res.message + created },
      ];
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
      {/* Bulle de Krea : deux usages, jamais les deux à la fois — l'accueil
          de la page (elle explique) et le survol (elle propose son aide). */}
      {guiding && guide ? (
        <GuideBubble key={guide.id} guide={guide} />
      ) : (
        !open &&
        hovered && (
          <KreaBubble>
            <p className="text-sm leading-relaxed text-foreground">
              Je peux faire quelque chose pour toi ?
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-2.5 text-xs font-semibold text-accent transition hover:underline"
            >
              Dis-moi ce dont tu as besoin →
            </button>
          </KreaBubble>
        )
      )}

      {/* Lanceur : Krea elle-même en lévitation, sans pastille orange autour.
          C'est le personnage qui appelle l'œil, pas un aplat de couleur. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={open ? "Fermer Krea" : "Ouvrir Krea, ta coach"}
        className={cn(
          "fixed bottom-5 end-5 z-40 inline-flex items-center justify-center rounded-full transition hover:scale-105",
          open && "size-12 bg-ink text-white shadow-lift",
        )}
      >
        {open ? <X className="size-5" /> : <KreaFloatingIcon size={56} />}
      </button>

      {open && (
        <div className="fixed bottom-24 end-5 z-40 flex max-h-[min(34rem,calc(100vh-9rem))] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-lift">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold">Krea</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="rounded-full p-1 text-muted transition hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {msgs.length === 0 ? (
              <div className="flex flex-col items-center pt-6 text-center">
                <KreaFloatingIcon size={92} priority />
                <p className="mt-7 text-sm text-muted">
                  Bonjour{firstName ? `, ${firstName}` : ""}
                </p>
                <p className="text-base font-bold">
                  Comment je peux t&apos;aider ?
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-secondary/70"
                    >
                      <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {msgs.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      m.role === "me"
                        ? "ms-auto bg-secondary text-foreground"
                        : "border border-border/60 bg-background text-foreground",
                    )}
                    dir="auto"
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {m.text}
                    </p>
                    {m.deeds?.map((d, j) => <DeedCard key={j} deed={d} />)}
                  </div>
                ))}

                {pending && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <KreaFloatingIcon size={26} />
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-muted" />
                    </span>
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
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-border/60 p-2.5"
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
              placeholder="Demande à Krea…"
              className="max-h-24 min-h-9 flex-1 resize-none rounded-2xl border border-border bg-background px-3.5 py-2 text-sm text-foreground [field-sizing:content] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

/** L'habillage commun : une bulle de dialogue posée au-dessus de Krea. */
function KreaBubble({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed bottom-[5.5rem] end-5 z-40 w-[min(17rem,calc(100vw-2.5rem))] rounded-2xl rounded-br-sm border border-border/70 bg-card p-3.5 shadow-lift"
      dir="auto"
    >
      {children}
    </div>
  );
}

/**
 * L'accueil d'UNE page. Monté avec `key={guide.id}` : changer de page le
 * remonte, donc le compteur d'étapes repart de zéro sans effet de
 * synchronisation.
 */
function GuideBubble({ guide }: { guide: GuidePage }) {
  const [index, setIndex] = useState(0);
  const step = guide.steps[index];
  const last = index === guide.steps.length - 1;

  return (
    <KreaBubble>
      <p className="text-sm leading-relaxed text-foreground">{step.text}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => markSeen(guide.id)}
          className="text-xs font-medium text-muted transition hover:text-foreground"
        >
          Passer
        </button>
        <div className="flex items-center gap-2">
          {guide.steps.length > 1 && (
            <span className="text-[11px] tabular-nums text-muted">
              {index + 1}/{guide.steps.length}
            </span>
          )}
          <button
            type="button"
            onClick={() => (last ? markSeen(guide.id) : setIndex(index + 1))}
            className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent/90"
          >
            {step.cta ?? "Suivant"}
          </button>
        </div>
      </div>
    </KreaBubble>
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
