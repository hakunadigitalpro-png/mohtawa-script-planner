"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Compass, FileText, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KreaFloatingIcon } from "./krea-floating-icon";
import { askKrea, type KreaDeed } from "@/app/(app)/krea-actions";
import type { KreaTurn } from "@/lib/krea";
import { requestTour, tourForPath } from "@/lib/krea-tours";

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

/** Krea se rappelle au bon souvenir après 5 minutes SANS RIEN FAIRE. */
const NUDGE_AFTER_IDLE_MS = 5 * 60 * 1000;
/** Et elle se tait toute seule : une bulle qui reste est une bulle qui gêne. */
const NUDGE_VISIBLE_MS = 8000;

/** Le curseur est dans un champ : on n'interrompt pas quelqu'un qui écrit. */
function isTyping() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

/**
 * La relance spontanée de Krea.
 *
 * Elle compte les minutes D'INACTIVITÉ, pas les minutes tout court. Une
 * horloge fixe parlerait par-dessus quelqu'un en plein travail — c'est tout
 * le reproche fait au trombone de Word. Ici elle ne se manifeste que dans un
 * silence : ni clic, ni frappe, ni défilement, ni changement de page.
 *
 * Trois autres silences volontaires : jamais quand l'onglet est en
 * arrière-plan (sinon on retrouve une bulle vieille de vingt minutes en
 * revenant), jamais pendant qu'on écrit, jamais quand elle a déjà quelque
 * chose à l'écran (`paused`).
 */
function useKreaNudge(paused: boolean) {
  const [nudging, setNudging] = useState(false);

  useEffect(() => {
    if (paused) return;
    let tick: number | undefined;
    let last = Date.now();

    function schedule(delay = NUDGE_AFTER_IDLE_MS) {
      tick = window.setTimeout(fire, delay);
    }
    function fire() {
      // On ne remet pas le minuteur à zéro à chaque geste (le défilement en
      // déclencherait des centaines) : on le laisse arriver à terme et on
      // regarde à ce moment-là depuis combien de temps plus rien ne bouge.
      const idle = Date.now() - last;
      if (idle < NUDGE_AFTER_IDLE_MS) {
        schedule(NUDGE_AFTER_IDLE_MS - idle);
        return;
      }
      if (document.visibilityState !== "visible" || isTyping()) {
        schedule();
        return;
      }
      setNudging(true);
      schedule();
    }
    function seen() {
      last = Date.now();
    }

    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) {
      document.addEventListener(e, seen, { passive: true });
    }
    document.addEventListener("visibilitychange", seen);
    schedule();

    return () => {
      window.clearTimeout(tick);
      for (const e of events) document.removeEventListener(e, seen);
      document.removeEventListener("visibilitychange", seen);
    };
  }, [paused]);

  // L'effacement automatique vit à part du minuteur, et ne dépend donc PAS de
  // `paused` : si le panneau s'ouvre pendant que la bulle est là, elle doit
  // quand même finir par s'éteindre, sinon elle ressurgit intacte à la
  // fermeture, sans plus rien pour la faire disparaître.
  useEffect(() => {
    if (!nudging) return;
    const t = window.setTimeout(() => setNudging(false), NUDGE_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [nudging]);

  return { nudging: nudging && !paused, hush: () => setNudging(false) };
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
  // Elle n'a qu'une bouche : tant qu'elle présente la page ou que le panneau
  // est ouvert, elle ne se relance pas par-dessus.
  const { nudging, hush } = useKreaNudge(open);
  // Survol ET relance font la même chose : elle s'anime.
  const alive = hovered || nudging;

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
    /* Une seule colonne ancrée en bas à droite : la bulle et le panneau se
       posent AU-DESSUS de Krea sans qu'on ait à deviner sa hauteur en pixels.
       `pointer-events-none` sur la colonne, rétabli sur chaque enfant — sinon
       le vide à gauche de Krea avalerait les clics de la page.
       En bas, on dégage la barre d'onglets mobile (4 rem) et l'encoche. */
    <div className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] end-5 z-40 flex flex-col items-end gap-2.5 md:bottom-6">
      {/* Bulle de Krea : au survol, et à sa relance toutes les 5 min. */}
      {!open &&
        alive && (
          /* Une seule phrase pour les deux déclencheurs. Deux formulations
             pour une même intention finissent toujours par diverger. */
          <KreaBubble live={!hovered}>
            <p className="text-sm leading-relaxed text-foreground">
              Je t&apos;aide ?
            </p>
            <button
              type="button"
              onClick={() => {
                hush();
                setOpen(true);
              }}
              className="mt-2.5 text-xs font-semibold text-accent transition hover:underline"
            >
              Dis-moi ce dont tu as besoin →
            </button>
          </KreaBubble>
        )}

      {open && (
        /* La hauteur max n'est pas la même sur téléphone et sur grand écran :
           en bas il faut dégager Krea et son ancrage, en haut la barre du
           haut (sélecteur de marque + cloche), que le panneau recouvrait
           sinon dès qu'il atteignait sa taille maximale. */
        <div className="pointer-events-auto flex max-h-[min(34rem,calc(100dvh-16rem))] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-lift md:max-h-[min(34rem,calc(100dvh-7rem))]">
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

          {/* Rejouer la visite de la page : une action locale, pas une question
              à l'IA — donc hors des suggestions, et toujours là, même en pleine
              conversation. Seulement là où une visite existe. */}
          {tourForPath(pathname, "team") && (
            <div className="border-t border-border/60 px-2.5 pt-2.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  requestTour();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
              >
                <Compass className="size-3.5 text-accent" />
                Fais-moi visiter cette page
              </button>
            </div>
          )}

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

      {/* Lanceur : Krea elle-même en lévitation, sans pastille orange autour.
          C'est le personnage qui appelle l'œil, pas un aplat de couleur. */}
      <button
        type="button"
        onClick={() => {
          hush();
          // Le MÊME bouton ouvre et ferme. Sans ça, à la fermeture il garde
          // le survol et le focus : la bulle resurgit dans la foulée, comme
          // si le clic n'avait pas été pris en compte. Au doigt c'est pire —
          // aucun `mouseleave` ne viendra la retirer.
          setHovered(false);
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={open ? "Fermer Krea" : "Ouvrir Krea, ta coach"}
        className={cn(
          "pointer-events-auto inline-flex items-center justify-center rounded-full transition hover:scale-105",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          open && "size-12 bg-ink text-white shadow-lift",
        )}
      >
        {open ? <X className="size-5" /> : <KreaFloatingIcon size={56} />}
      </button>
    </div>
  );
}

/**
 * L'habillage commun : une bulle de dialogue posée au-dessus de Krea.
 *
 * `live` quand c'est Krea qui parle d'elle-même : la bulle apparaît sans
 * qu'on ait rien demandé, donc elle s'annonce aussi aux lecteurs d'écran.
 */
function KreaBubble({
  children,
  live,
}: {
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div
      // Largeur AU CONTENU, plafonnée : « Je t'aide ? » dans une bulle de
      // 17 rem, c'est trois mots perdus dans un cadre vide.
      className="krea-pop pointer-events-auto w-fit max-w-[min(17rem,calc(100vw-2.5rem))] rounded-2xl rounded-br-sm border border-border/70 bg-card p-3.5 shadow-lift"
      dir="auto"
      role={live ? "status" : undefined}
    >
      {children}
    </div>
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
