import { describe, expect, it } from "vitest";
import {
  hasMaterial,
  isForward,
  isLate,
  isTrulyReady,
  nextStep,
  primaryPublication,
  programmedStatusFor,
  rankOf,
  sendBlockerMessage,
  statusAfterFilming,
  statusAfterFormat,
  todayISO,
  whyNotProgrammed,
  whyNotSendable,
} from "./content-lifecycle";

describe("isForward — un geste n'avance que vers l'avant", () => {
  it("accepte les transitions du bouton, dans les deux familles", () => {
    expect(isForward("approved", "scheduled")).toBe(true);
    expect(isForward("approved", "programmed")).toBe(true);
    expect(isForward("approved", "live")).toBe(true);
    expect(isForward("scheduled", "live")).toBe(true);
    expect(isForward("programmed", "live")).toBe(true);
  });

  it("refuse de reculer ou de rester sur place", () => {
    expect(isForward("live", "approved")).toBe(false);
    expect(isForward("approved", "approved")).toBe(false);
    expect(isForward("scheduled", "programmed")).toBe(false);
  });

  it("ne mène nulle part depuis ou vers un statut inconnu", () => {
    expect(isForward("bidule", "live")).toBe(false);
    expect(isForward("approved", "bidule")).toBe(false);
    expect(rankOf("bidule")).toBe(-1);
  });

  it("tient `published` (legacy) pour l'équivalent de `live`", () => {
    expect(rankOf("published")).toBe(rankOf("live"));
  });
});

describe("programmedStatusFor — le mot de chaque famille", () => {
  it("dit Programmé à un post et Programmée à une vidéo", () => {
    expect(programmedStatusFor("post")).toBe("programmed");
    expect(programmedStatusFor("carousel")).toBe("programmed");
    expect(programmedStatusFor("infographic")).toBe("programmed");
    expect(programmedStatusFor("reel")).toBe("scheduled");
    expect(programmedStatusFor("story")).toBe("scheduled");
    expect(programmedStatusFor("vlog")).toBe("scheduled");
  });
});

describe("whyNotProgrammed — Programmé exige une date, par tous les chemins", () => {
  it("refuse Programmé sans publication datée, avec la raison", () => {
    expect(whyNotProgrammed({ to: "programmed", hasDatedPublication: false })).toMatch(
      /date/i,
    );
    expect(whyNotProgrammed({ to: "scheduled", hasDatedPublication: false })).toMatch(
      /date/i,
    );
  });

  it("laisse passer avec une date, et ne regarde pas les autres statuts", () => {
    expect(whyNotProgrammed({ to: "programmed", hasDatedPublication: true })).toBeNull();
    expect(whyNotProgrammed({ to: "editing", hasDatedPublication: false })).toBeNull();
    expect(whyNotProgrammed({ to: "live", hasDatedPublication: false })).toBeNull();
  });
});

describe("primaryPublication — la même que le trigger de la base", () => {
  it("prend la plus ancienne par date, les sans-date en dernier", () => {
    const pubs = [
      { id: "a", scheduled_date: null, created_at: "2026-01-01" },
      { id: "b", scheduled_date: "2026-10-20", created_at: "2026-01-02" },
      { id: "c", scheduled_date: "2026-10-15", created_at: "2026-01-03" },
    ];
    expect(primaryPublication(pubs)?.id).toBe("c");
  });

  it("départage à la création quand les dates sont égales", () => {
    const pubs = [
      { id: "b", scheduled_date: "2026-10-20", created_at: "2026-01-02" },
      { id: "a", scheduled_date: "2026-10-20", created_at: "2026-01-01" },
    ];
    expect(primaryPublication(pubs)?.id).toBe("a");
  });

  it("renvoie null sans publication", () => {
    expect(primaryPublication([])).toBeNull();
  });
});

describe("nextStep — un seul bouton, une seule réponse par statut", () => {
  const today = "2026-10-12";
  const base = { type: "reel", publicationDate: "2026-10-20", today };

  it("propose d'envoyer au client tant que le contenu se fabrique", () => {
    for (const status of ["idea", "selected", "script", "filming", "editing"]) {
      expect(nextStep({ ...base, status })).toEqual({ kind: "send_to_client" });
    }
    for (const status of ["design", "needs_revision"]) {
      expect(nextStep({ ...base, type: "post", status })).toEqual({
        kind: "send_to_client",
      });
    }
  });

  it("attend quand c'est chez le client", () => {
    expect(nextStep({ ...base, status: "pending_review" })).toEqual({
      kind: "waiting_client",
    });
  });

  it("propose « C'est programmé » une fois validé avec une date à venir, avec le mot de la famille", () => {
    expect(nextStep({ ...base, status: "approved" })).toEqual({
      kind: "mark_programmed",
      to: "scheduled",
      needsDate: false,
    });
    expect(nextStep({ ...base, type: "carousel", status: "approved" })).toEqual({
      kind: "mark_programmed",
      to: "programmed",
      needsDate: false,
    });
  });

  it("réclame une date quand aucune publication datée n'existe", () => {
    const step = nextStep({ ...base, status: "approved", publicationDate: null });
    expect(step).toMatchObject({ kind: "mark_programmed", needsDate: true });
  });

  it("propose « C'est en ligne » directement quand la date est déjà passée", () => {
    expect(
      nextStep({ ...base, status: "approved", publicationDate: "2026-10-11" }),
    ).toEqual({ kind: "mark_live", to: "live" });
    expect(nextStep({ ...base, status: "approved", publicationDate: today })).toEqual({
      kind: "mark_live",
      to: "live",
    });
  });

  it("propose « C'est en ligne » une fois programmé, quel que soit le mot", () => {
    expect(nextStep({ ...base, status: "scheduled" })).toEqual({
      kind: "mark_live",
      to: "live",
    });
    expect(nextStep({ ...base, type: "post", status: "programmed" })).toEqual({
      kind: "mark_live",
      to: "live",
    });
  });

  it("demande un format avant de programmer ou de sortir un contenu qui n'en a pas", () => {
    expect(nextStep({ ...base, type: null, status: "approved" })).toEqual({
      kind: "needs_format",
    });
    expect(nextStep({ ...base, type: null, status: "scheduled" })).toEqual({
      kind: "needs_format",
    });
    // En fabrication, le garde « rien à montrer » est le sujet du chantier 2.
    expect(nextStep({ ...base, type: null, status: "idea" })).toEqual({
      kind: "send_to_client",
    });
  });

  it("montre le lien une fois en ligne, legacy compris", () => {
    expect(nextStep({ ...base, status: "live", url: "https://x/y" })).toEqual({
      kind: "online",
      url: "https://x/y",
    });
    expect(nextStep({ ...base, status: "published" })).toEqual({
      kind: "online",
      url: null,
    });
  });
});

describe("statusAfterFilming — le tournage fait avancer une vidéo", () => {
  it("met en Tournage dès une première scène filmée, même depuis Idée", () => {
    expect(
      statusAfterFilming({ status: "script", type: "reel", filmed: 1, total: 4 }),
    ).toBe("filming");
    expect(
      statusAfterFilming({ status: "idea", type: "reel", filmed: 1, total: 4 }),
    ).toBe("filming");
    expect(
      statusAfterFilming({ status: "selected", type: "vlog", filmed: 1, total: 2 }),
    ).toBe("filming");
  });

  it("met en Montage quand tout est filmé", () => {
    expect(
      statusAfterFilming({ status: "filming", type: "reel", filmed: 4, total: 4 }),
    ).toBe("editing");
    expect(
      statusAfterFilming({ status: "script", type: "story", filmed: 5, total: 5 }),
    ).toBe("editing");
  });

  it("ne recule jamais et ne dépasse jamais Montage", () => {
    expect(
      statusAfterFilming({ status: "editing", type: "reel", filmed: 1, total: 4 }),
    ).toBeNull();
    expect(
      statusAfterFilming({ status: "approved", type: "reel", filmed: 4, total: 4 }),
    ).toBeNull();
    expect(
      statusAfterFilming({ status: "pending_review", type: "reel", filmed: 4, total: 4 }),
    ).toBeNull();
  });

  it("ne fait rien sans scène, sans scène filmée, sans format ou pour un format simple", () => {
    expect(
      statusAfterFilming({ status: "script", type: "reel", filmed: 0, total: 0 }),
    ).toBeNull();
    expect(
      statusAfterFilming({ status: "script", type: "reel", filmed: 0, total: 3 }),
    ).toBeNull();
    expect(
      statusAfterFilming({ status: "script", type: null, filmed: 1, total: 3 }),
    ).toBeNull();
    expect(
      statusAfterFilming({ status: "design", type: "carousel", filmed: 1, total: 3 }),
    ).toBeNull();
  });
});

describe("statusAfterFormat — choisir le format ouvre l'écriture", () => {
  it("donne Script à une vidéo et Design à un format simple", () => {
    expect(statusAfterFormat({ status: "idea", type: "reel" })).toBe("script");
    expect(statusAfterFormat({ status: "selected", type: "vlog" })).toBe("script");
    expect(statusAfterFormat({ status: "idea", type: "carousel" })).toBe("design");
  });

  it("ne ramène jamais en arrière un contenu déjà avancé", () => {
    expect(statusAfterFormat({ status: "editing", type: "reel" })).toBeNull();
    expect(statusAfterFormat({ status: "approved", type: "post" })).toBeNull();
  });
});

describe("hasMaterial — la matière selon le format", () => {
  it("un reel a besoin d'un script, un vlog d'une voix off", () => {
    expect(hasMaterial("reel", { script: "Bonjour" })).toBe(true);
    expect(hasMaterial("reel", { script: "   " })).toBe(false);
    expect(hasMaterial("vlog", { voiceover: "On y va" })).toBe(true);
    expect(hasMaterial("vlog", {})).toBe(false);
  });

  it("une story a besoin d'une diapo écrite, un post d'un visuel", () => {
    expect(hasMaterial("story", { slidesWithText: 1 })).toBe(true);
    expect(hasMaterial("story", { slidesWithText: 0 })).toBe(false);
    expect(hasMaterial("post", { visuals: 1 })).toBe(true);
    expect(hasMaterial("carousel", { visuals: 0 })).toBe(false);
    expect(hasMaterial("infographic", { visuals: 2 })).toBe(true);
  });

  it("sans format, il n'y a rien à juger", () => {
    expect(hasMaterial(null, { script: "Bonjour", visuals: 3 })).toBe(false);
  });
});

describe("isTrulyReady — « Prêt » ne rassure plus à tort", () => {
  it("n'est pas prêt en écriture ni refusé par le client, même avec de la matière", () => {
    for (const status of ["idea", "selected", "script", "design", "needs_revision"]) {
      expect(isTrulyReady({ status, hasMaterial: true })).toBe(false);
    }
  });

  it("n'est pas prêt sans matière, même en Montage", () => {
    expect(isTrulyReady({ status: "editing", hasMaterial: false })).toBe(false);
  });

  it("est prêt avec la matière, passé l'écriture", () => {
    for (const status of ["filming", "editing", "pending_review", "approved", "scheduled", "live"]) {
      expect(isTrulyReady({ status, hasMaterial: true })).toBe(true);
    }
  });
});

describe("isLate — la date est passée et ce n'est pas sorti", () => {
  const today = "2026-10-12";

  it("signale un contenu daté d'hier qui n'est pas en ligne, à toute étape", () => {
    expect(isLate({ status: "editing", date: "2026-10-11", today })).toBe(true);
    expect(isLate({ status: "pending_review", date: "2026-10-01", today })).toBe(true);
    expect(isLate({ status: "approved", date: "2026-09-30", today })).toBe(true);
    expect(isLate({ status: "idea", date: "2026-09-30", today })).toBe(true);
  });

  it("ne signale ni aujourd'hui, ni demain, ni ce qui est en ligne", () => {
    expect(isLate({ status: "editing", date: today, today })).toBe(false);
    expect(isLate({ status: "editing", date: "2026-10-13", today })).toBe(false);
    expect(isLate({ status: "live", date: "2026-10-01", today })).toBe(false);
    expect(isLate({ status: "published", date: "2026-10-01", today })).toBe(false);
  });

  it("une idée sans date n'est jamais en retard", () => {
    expect(isLate({ status: "idea", date: null, today })).toBe(false);
    expect(isLate({ status: "idea", date: undefined, today })).toBe(false);
  });
});

describe("whyNotSendable — la règle de l'écran de validation, avant l'envoi", () => {
  const ok = { type: "carousel", hasClient: true, visuals: 2, script: null, caption: null };

  it("laisse partir ce que le client pourra voir", () => {
    expect(whyNotSendable(ok)).toBeNull();
    expect(whyNotSendable({ ...ok, type: "reel", visuals: 0, script: "Bonjour" })).toBeNull();
    expect(whyNotSendable({ ...ok, type: "post", visuals: 0, caption: "Légende" })).toBeNull();
  });

  it("demande un format avant tout", () => {
    expect(whyNotSendable({ ...ok, type: null })).toEqual({ kind: "needs_format" });
  });

  it("refuse ce qui n'a rien à montrer, avec le mot de la famille", () => {
    expect(
      whyNotSendable({ ...ok, type: "reel", visuals: 0, script: "  ", caption: null }),
    ).toEqual({ kind: "nothing_to_review", family: "video" });
    expect(
      whyNotSendable({ ...ok, type: "vlog", visuals: 0, script: null, caption: null }),
    ).toEqual({ kind: "nothing_to_review", family: "video" });
    expect(
      whyNotSendable({ ...ok, type: "story", visuals: 0, script: null, caption: null }),
    ).toEqual({ kind: "nothing_to_review", family: "story" });
    expect(
      whyNotSendable({ ...ok, type: "post", visuals: 0, script: null, caption: "" }),
    ).toEqual({ kind: "nothing_to_review", family: "simple" });
  });

  it("refuse d'envoyer à personne, mais après la matière", () => {
    expect(whyNotSendable({ ...ok, hasClient: false })).toEqual({ kind: "no_client" });
    expect(
      whyNotSendable({ ...ok, hasClient: false, visuals: 0 }),
    ).toEqual({ kind: "nothing_to_review", family: "simple" });
  });

  it("dit chaque refus avec des mots", () => {
    expect(sendBlockerMessage({ kind: "needs_format" })).toMatch(/format/);
    expect(sendBlockerMessage({ kind: "no_client" })).toMatch(/client/);
    expect(sendBlockerMessage({ kind: "nothing_to_review", family: "video" })).toMatch(/script/);
    expect(sendBlockerMessage({ kind: "nothing_to_review", family: "story" })).toMatch(/diapo/);
    expect(sendBlockerMessage({ kind: "nothing_to_review", family: "simple" })).toMatch(/visuel/);
  });
});

describe("todayISO", () => {
  it("écrit la date locale sur dix caractères, mois et jour sur deux chiffres", () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayISO(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
