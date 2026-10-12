/* =========================================================================
   Le cycle de vie d'un contenu — un seul moteur
   -------------------------------------------------------------------------
   Un statut change par un GESTE explicite, ou par le temps qui passe (le
   passage en Live à la date, `recompute_live_statuses`). Jamais par une case
   cachée : l'ancienne RPC `recompute_content_status` (0015) lisait une
   checklist que plus personne n'écrivait, et son verrou `auto_status`
   coupait la seule règle encore vivante dès qu'on touchait au statut.

   Tout ce qui décide d'un statut est ici, en logique pure et testée. Les
   actions serveur appellent ces fonctions ; elles n'inventent rien — et la
   même règle vaut pour le bouton d'en-tête, le menu Statut du Plan et le
   menu ⋮ des cartes : une règle, trois chemins.

   Le vocabulaire reste celui de `lib/constants.ts` — deux familles (vidéo,
   formats simples) qui partagent leur début (Idée, Retenue), leur boucle
   client et leur fin (Validé, Programmé·e, Live).
   ========================================================================= */

import { isLiveStatus, isSimpleType } from "./constants";

/**
 * Le rang de chaque statut sur UNE ligne de temps commune aux deux familles.
 * Un même rang pour deux statuts = la même étape, dite avec le mot de sa
 * famille (Script / Design, Programmée / Programmé). Sert à ne jamais
 * reculer par un geste — la correction manuelle, elle, reste libre.
 */
const RANK: Record<string, number> = {
  idea: 0,
  selected: 1,
  script: 2,
  design: 2,
  filming: 3,
  editing: 4,
  pending_review: 5,
  needs_revision: 5,
  approved: 6,
  scheduled: 7,
  programmed: 7,
  live: 8,
  published: 8,
};

export function rankOf(status: string | null | undefined): number {
  return RANK[status ?? ""] ?? -1;
}

/** Un geste n'avance que vers l'avant. Un statut inconnu ne mène nulle part. */
export function isForward(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  const a = rankOf(from);
  const b = rankOf(to);
  return a >= 0 && b >= 0 && b > a;
}

/**
 * « Programmé » se dit `programmed` pour un post, un carrousel ou une
 * infographie, `scheduled` pour une vidéo — c'est le vocabulaire existant
 * (0041, 0045), pas un troisième mot.
 */
export function programmedStatusFor(
  type: string | null | undefined,
): "programmed" | "scheduled" {
  return isSimpleType(type) ? "programmed" : "scheduled";
}

export function isProgrammedStatus(status: string | null | undefined): boolean {
  return status === "programmed" || status === "scheduled";
}

/**
 * « Programmé » exige une date : c'est elle que `recompute_live_statuses`
 * lit pour passer en Live, et elle qui dit « en retard ». Sans date, un
 * contenu programmé resterait programmé pour toujours, invisible. La règle
 * vaut pour le bouton ET pour la correction manuelle — sinon ce sont deux
 * logiques. Renvoie la raison du refus, ou `null` si c'est permis.
 */
export function whyNotProgrammed(input: {
  to: string;
  hasDatedPublication: boolean;
}): string | null {
  if (!isProgrammedStatus(input.to)) return null;
  if (input.hasDatedPublication) return null;
  return "Donne-lui d'abord une date dans Publications.";
}

/**
 * La publication « principale » d'un contenu : la plus ancienne par date,
 * puis par création — la même que celle que le trigger de la base recopie
 * dans `contents.date` / `platform` / `video_url` (0020).
 */
export function primaryPublication<
  T extends { scheduled_date: string | null; created_at: string },
>(publications: T[]): T | null {
  if (publications.length === 0) return null;
  return [...publications].sort((a, b) => {
    const da = a.scheduled_date ?? "9999-99-99";
    const db = b.scheduled_date ?? "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    return a.created_at.localeCompare(b.created_at);
  })[0];
}

/** Les statuts où « Prêt » serait un mensonge : rien à montrer, ou refusé. */
const NOT_READY = new Set(["idea", "selected", "script", "design", "needs_revision"]);

export type NextStep =
  /** Le contenu est en fabrication : on peut l'envoyer au client. */
  | { kind: "send_to_client" }
  /** Chez le client, on attend sa décision. */
  | { kind: "waiting_client" }
  /** Validé ou programmé sans format : rien ne peut sortir sans format. */
  | { kind: "needs_format" }
  /** Validé : dire qu'il est programmé. `needsDate` : aucune date connue. */
  | { kind: "mark_programmed"; to: "programmed" | "scheduled"; needsDate: boolean }
  /** Programmé, ou validé avec une date déjà passée : dire qu'il est en ligne. */
  | { kind: "mark_live"; to: "live" }
  /** En ligne. `url` : le lien s'il a été collé. */
  | { kind: "online"; url: string | null };

/**
 * Ce que le bouton d'en-tête de la fiche propose MAINTENANT. Une seule
 * réponse par statut : c'est ce qui fait qu'un bouton suffit.
 *
 * Validé avec une date déjà passée → « C'est en ligne » directement : la
 * patronne de PME poste à la main le jour J, elle ne « programme » pas. Lui
 * faire inventer une date future pour dire que c'est fait serait une étape
 * de trop, et fausse.
 */
export function nextStep(input: {
  status: string;
  type: string | null;
  /** Date de la publication principale, `YYYY-MM-DD`, ou null. */
  publicationDate: string | null;
  /** Aujourd'hui, `YYYY-MM-DD`. */
  today: string;
  /** Le lien de la publication principale, s'il est renseigné. */
  url?: string | null;
}): NextStep {
  const { status, type, publicationDate, today } = input;
  if (status === "pending_review") return { kind: "waiting_client" };
  if (isLiveStatus(status)) return { kind: "online", url: input.url ?? null };
  if (status === "approved" || isProgrammedStatus(status)) {
    if (!type) return { kind: "needs_format" };
    if (isProgrammedStatus(status)) return { kind: "mark_live", to: "live" };
    if (publicationDate && publicationDate <= today) {
      return { kind: "mark_live", to: "live" };
    }
    return {
      kind: "mark_programmed",
      to: programmedStatusFor(type),
      needsDate: !publicationDate,
    };
  }
  return { kind: "send_to_client" };
}

/**
 * Ce que le tournage fait au statut d'une vidéo : une première scène filmée
 * la met en Tournage, toutes filmées la mettent en Montage — depuis
 * n'importe quel statut d'avant (Idée, Retenue, Script : un reel créé par
 * la modale reste « Idée » jusqu'à ce qu'on le fasse avancer). Jamais en
 * arrière, jamais au-delà de Montage (un contenu validé qu'on re-filme ne
 * redescend pas), jamais pour un format simple (il ne se tourne pas).
 *
 * Renvoie le nouveau statut, ou `null` si rien ne change.
 */
export function statusAfterFilming(input: {
  status: string;
  type: string | null;
  filmed: number;
  total: number;
}): "filming" | "editing" | null {
  const { status, type, filmed, total } = input;
  if (!type || isSimpleType(type)) return null;
  if (total <= 0 || filmed <= 0) return null;
  const target = filmed >= total ? "editing" : "filming";
  return isForward(status, target) ? target : null;
}

/**
 * Le statut d'écriture que donne le choix du format : « Script » pour une
 * vidéo, « Design » pour un post, un carrousel ou une infographie. Ne
 * s'applique qu'à un contenu encore en Idée / Retenue — choisir le format
 * d'un contenu déjà en Montage ne le ramène pas en arrière.
 */
export function statusAfterFormat(input: {
  status: string;
  type: string;
}): "script" | "design" | null {
  if (input.status !== "idea" && input.status !== "selected") return null;
  return isSimpleType(input.type) ? "design" : "script";
}

/**
 * La matière d'un contenu existe-t-elle ? Un script pour une vidéo, du texte
 * sur une diapo pour une story, un visuel pour un post, un carrousel ou une
 * infographie. Sans format, il n'y a rien à juger.
 */
export function hasMaterial(
  type: string | null | undefined,
  facts: {
    /** Reel : `script_full`, ou à défaut le premier bloc guidé. */
    script?: string | null;
    /** Vlog : la voix off. */
    voiceover?: string | null;
    /** Story : nombre de diapos qui portent du texte. */
    slidesWithText?: number;
    /** Formats simples : nombre de visuels. */
    visuals?: number;
  },
): boolean {
  const filled = (s: string | null | undefined) => Boolean(s && s.trim());
  switch (type) {
    case "reel":
      return filled(facts.script);
    case "vlog":
      return filled(facts.voiceover);
    case "story":
      return (facts.slidesWithText ?? 0) > 0;
    case "post":
    case "carousel":
    case "infographic":
      return (facts.visuals ?? 0) > 0;
    default:
      return false;
  }
}

/**
 * « Prêt » sur le tableau de bord : la matière existe ET le contenu n'est
 * ni en écriture, ni refusé par le client. Un reel passé en « Script » sans
 * une ligne n'est pas prêt ; un reel en Montage sans script non plus ; un
 * carrousel « À réviser » non plus, le client vient de le dire.
 */
export function isTrulyReady(input: {
  status: string;
  hasMaterial: boolean;
}): boolean {
  return input.hasMaterial && !NOT_READY.has(input.status);
}

/**
 * En retard : la date est passée et le contenu n'est pas sorti. Peu importe
 * l'étape — chez le client ou validé, la date est passée quand même. Calculé
 * à la lecture, jamais par une tâche de fond. Les dates sont des `YYYY-MM-DD`,
 * comparables telles quelles.
 */
export function isLate(input: {
  status: string;
  date: string | null | undefined;
  today: string;
}): boolean {
  const { status, date, today } = input;
  if (!date) return false;
  if (isLiveStatus(status)) return false;
  return date < today;
}

/** Aujourd'hui en `YYYY-MM-DD`, dans le fuseau du serveur. */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
