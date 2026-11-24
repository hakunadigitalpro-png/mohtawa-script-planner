import { describe, expect, it } from "vitest";
import {
  CONTENT_TYPES,
  GROUPED_CONTENT_TYPES,
  isFilmedType,
  isLongformType,
  isSimpleType,
  captionTabForType,
  mainTabForType,
  platformsForType,
  statusLabel,
  statusesForType,
} from "./constants";
import {
  hasMaterial,
  initialStatus,
  programmedStatusFor,
  sendBlockerMessage,
  statusAfterFilming,
  statusAfterVideoReady,
  statusForFormat,
  whyNotSendable,
} from "./content-lifecycle";
import {
  LONGFORM_SPECS,
  countWords,
  detectLanguage,
  lengthLabel,
  longformChanges,
  longformSpec,
  mergeLongform,
  quoteIsInSource,
  sectionsToText,
  type LongformDraft,
} from "./longform";

const LONG = ["long_video", "livestream", "podcast", "article"] as const;

describe("chaque format est entièrement décrit", () => {
  it("apparaît une fois dans les menus groupés, avec au moins une plateforme", () => {
    expect(GROUPED_CONTENT_TYPES.map((t) => t.value).sort()).toEqual(
      CONTENT_TYPES.map((t) => t.value).sort(),
    );
    for (const t of CONTENT_TYPES) {
      expect(platformsForType(t.value).length, t.value).toBeGreaterThan(0);
    }
  });

  it("tout format long a son éditeur, et aucun autre", () => {
    for (const t of CONTENT_TYPES) {
      expect(Boolean(longformSpec(t.value)), t.value).toBe(isLongformType(t.value));
    }
    expect(Object.keys(LONGFORM_SPECS).sort()).toEqual([...LONG].sort());
  });

  it("un format inconnu ou absent ne sait rien faire", () => {
    for (const t of [null, undefined, "", "bidule"]) {
      expect(isSimpleType(t)).toBe(false);
      expect(isFilmedType(t)).toBe(false);
      expect(isLongformType(t)).toBe(false);
    }
    expect(mainTabForType(null)).toBe("content");
  });

  it("les formats d'avant n'ont pas bougé", () => {
    for (const t of ["reel", "story", "vlog"]) {
      expect(isFilmedType(t)).toBe(true);
      expect(isSimpleType(t)).toBe(false);
      expect(mainTabForType(t)).toBe("video");
    }
    for (const t of ["post", "carousel", "infographic"]) {
      expect(isSimpleType(t)).toBe(true);
      expect(isFilmedType(t)).toBe(false);
      expect(mainTabForType(t)).toBe("content");
    }
  });
});

describe("captionTabForType", () => {
  it("mène là où la légende s'écrit vraiment", () => {
    expect(captionTabForType("reel")).toBe("caption");
    expect(captionTabForType("post")).toBe("content");
    for (const t of LONG) expect(captionTabForType(t)).toBe("content");
  });
});

describe("les statuts des formats longs — aucun mot nouveau en base", () => {
  it("naît à son étape d'écriture et se programme avec le mot de sa famille", () => {
    expect(initialStatus("long_video")).toBe("script");
    expect(initialStatus("livestream")).toBe("script");
    expect(initialStatus("podcast")).toBe("script");
    expect(initialStatus("article")).toBe("design");
    expect(programmedStatusFor("livestream")).toBe("scheduled");
    expect(programmedStatusFor("article")).toBe("programmed");
  });

  it("un direct et un article ne passent ni par Tournage ni par Montage", () => {
    for (const type of ["livestream", "article"]) {
      const values = statusesForType(type).map((s) => s.value as string);
      expect(values).not.toContain("filming");
      expect(values).not.toContain("editing");
      expect(statusForFormat({ to: "filming", type })).toHaveProperty("error");
      expect(statusForFormat({ to: "editing", type })).toHaveProperty("error");
      expect(
        statusAfterFilming({ status: "script", type, filmed: 1, total: 1 }),
      ).toBeNull();
      // Coller le lien du replay ne le met pas « en montage ».
      expect(statusAfterVideoReady({ status: "script", type })).toBeNull();
    }
  });

  it("un podcast et une vidéo longue se tournent et se montent", () => {
    for (const type of ["long_video", "podcast"]) {
      expect(statusForFormat({ to: "filming", type })).toEqual({ status: "filming" });
      expect(statusAfterVideoReady({ status: "script", type })).toBe("editing");
    }
  });

  it("dit le mot juste sans changer la valeur", () => {
    expect(statusLabel("design", "article")).toBe("Rédaction");
    expect(statusLabel("design", "post")).toBe("Design");
    expect(statusLabel("filming", "podcast")).toBe("Enregistrement");
    expect(statusLabel("script", "livestream")).toBe("Préparation");
    expect(statusLabel("script")).toBe("Script");
    const article = statusesForType("article").find((s) => s.value === "design");
    expect(article?.label).toBe("Rédaction");
  });

  it("n'est prêt, ni envoyable, qu'avec du texte", () => {
    for (const type of LONG) {
      expect(hasMaterial(type, {})).toBe(false);
      expect(hasMaterial(type, { partsWithText: 1 })).toBe(true);
      const base = { type, hasClient: true, visuals: 0, script: null, caption: null };
      const blocker = whyNotSendable(base);
      expect(blocker?.kind).toBe("nothing_to_review");
      expect(whyNotSendable({ ...base, script: "Chapitre 1" })).toBeNull();
    }
    expect(
      sendBlockerMessage({ kind: "nothing_to_review", family: "article" }),
    ).toBe("Écris d'abord le texte.");
  });
});

describe("lengthLabel — le compteur de chaque format", () => {
  const part = (words: number, minutes: number | null = null) => ({
    body: "mot ".repeat(words),
    minutes,
  });

  it("compte l'oral, la lecture, ou les minutes prévues", () => {
    expect(lengthLabel("long_video", [part(1500), part(300)])).toBe("≈ 12 min à l'oral");
    expect(lengthLabel("article", [part(850)])).toBe("850 mots · ≈ 4 min de lecture");
    expect(lengthLabel("podcast", [part(900, 5), part(0, 37)])).toBe("42 min prévues");
  });

  it("ne dit rien quand il n'y a rien", () => {
    expect(lengthLabel("long_video", [])).toBe("");
    expect(lengthLabel("podcast", [part(50)])).toBe("");
    expect(countWords("  \n ")).toBe(0);
  });
});

const draft = (
  parts: [id: string, body: string][],
  guestName = "",
): LongformDraft => ({
  parts: parts.map(([id, body]) => ({ id, title: id.toUpperCase(), body, minutes: null })),
  guestName,
  guestBio: "",
});
const bodies = (d: LongformDraft) => d.parts.map((p) => `${p.id}:${p.body}`);

describe("mergeLongform — rien de ce qu'elle écrit ne disparaît", () => {
  it("garde ce qui a été écrit pendant la sauvegarde", () => {
    // Elle enregistre « a », Krea remplit « b » pendant l'aller-retour.
    const baseline = draft([["a", ""], ["b", ""]]);
    const incoming = draft([["a", "écrit"], ["b", ""]]);
    const current = draft([["a", "écrit, puis complété"], ["b", "texte de Krea"]]);
    expect(bodies(mergeLongform(current, baseline, incoming))).toEqual([
      "a:écrit, puis complété",
      "b:texte de Krea",
    ]);
  });

  it("prend le travail d'une collègue là où elle n'a rien touché", () => {
    const baseline = draft([["a", "1"], ["b", "2"]]);
    const incoming = draft([["a", "1 corrigé"], ["b", "2"], ["c", "ajout"]]);
    const current = draft([["a", "1"], ["b", "2 à moi"]]);
    expect(bodies(mergeLongform(current, baseline, incoming))).toEqual([
      "a:1 corrigé",
      "b:2 à moi",
      "c:ajout",
    ]);
  });

  it("une partie retirée ne revient pas, une partie ajoutée reste", () => {
    const baseline = draft([["a", "1"], ["b", "2"], ["c", "3"]]);
    // « c » retirée ailleurs, « b » retirée ici, « n » ajoutée ici.
    const incoming = draft([["a", "1"], ["b", "2"]]);
    const current = draft([["a", "1"], ["c", "3"], ["n", "nouveau"]]);
    expect(bodies(mergeLongform(current, baseline, incoming))).toEqual([
      "a:1",
      "n:nouveau",
    ]);
  });

  it("respecte l'ordre de celle qui a déplacé", () => {
    const baseline = draft([["a", "1"], ["b", "2"]]);
    const incoming = draft([["a", "1"], ["b", "2"]]);
    const current = draft([["b", "2"], ["a", "1"]]);
    expect(bodies(mergeLongform(current, baseline, incoming))).toEqual(["b:2", "a:1"]);
    // Et l'ordre changé ailleurs, quand elle n'a rien déplacé.
    expect(
      bodies(mergeLongform(baseline, baseline, draft([["b", "2"], ["a", "1"]]))),
    ).toEqual(["b:2", "a:1"]);
  });

  it("garde l'invité en cours de saisie", () => {
    expect(
      mergeLongform(draft([], "Sonia"), draft([]), draft([], "Autre")).guestName,
    ).toBe("Sonia");
  });
});

describe("article : rôle et sous-titre suivent la fusion", () => {
  const d = (role: string, subtitle: string): LongformDraft => ({
    ...draft([["a", "1"]]),
    subtitle,
    parts: [{ id: "a", title: "A", body: "1", minutes: null, role }],
  });
  it("garde le rôle et le sous-titre en cours de saisie", () => {
    const m = mergeLongform(d("item", "à moi"), d("text", ""), d("text", "ailleurs"));
    expect(m.parts[0].role).toBe("item");
    expect(m.subtitle).toBe("à moi");
    expect(mergeLongform(d("text", ""), d("text", ""), d("item", "x"))).toMatchObject({
      subtitle: "x",
    });
  });
  it("un changement de rôle ou de sous-titre s'envoie, seul", () => {
    const diff = longformChanges(d("text", ""), d("item", "neuf"));
    expect(diff.changed).toHaveLength(1);
    expect(diff.subtitle).toBe("neuf");
    expect(longformChanges(d("text", "x"), d("text", "x"))).toMatchObject({ changed: [] });
    expect(longformChanges(d("text", "x"), d("text", "x")).subtitle).toBeUndefined();
  });
  it("un article remplacé prend toute la place : rien de l'ancien ne reste", () => {
    const old = draft([["a", "1"], ["b", "2"]]);
    expect(bodies(mergeLongform(old, old, draft([["x", "n1"], ["y", "n2"]])))).toEqual([
      "x:n1",
      "y:n2",
    ]);
  });
});

describe("longformChanges — n'envoyer que la différence", () => {
  it("une partie corrigée n'emporte pas les autres", () => {
    const saved = draft([["a", "1"], ["b", "2"], ["c", "3"]]);
    const now = draft([["c", "3"], ["b", "2 bis"], ["n", "neuf"]]);
    const diff = longformChanges(saved, now);
    expect(diff.changed.map((p) => [p.id, p.existing])).toEqual([["b", true], ["n", false]]);
    expect(diff.order).toEqual(["c", "b", "n"]);
    expect(diff.deleted).toEqual(["a"]);
    expect(diff.guest).toBeUndefined();
  });

  it("n'envoie l'invité que s'il a changé", () => {
    expect(longformChanges(draft([]), draft([], "Sonia")).guest).toEqual({
      name: "Sonia",
      bio: "",
    });
  });
});

describe("detectLanguage — ne pas changer la langue d'un texte en le réécrivant", () => {
  it("reconnaît les trois langues d'un article", () => {
    expect(detectLanguage("Why the questions you ask the mill matter to you and that is it")).toBe("en");
    expect(detectLanguage("Les questions que tu poses et la réponse")).toBe("fr");
    expect(detectLanguage("من يراقب في نفس اليوم")).toBe("ar_tn");
    expect(detectLanguage("")).toBe("fr");
  });
});

describe("sectionsToText", () => {
  it("assemble titres et textes, sans trous", () => {
    expect(
      sectionsToText([
        { title: "Un", body: "Texte." },
        { title: null, body: null },
        { title: "Deux", body: "" },
      ]),
    ).toBe("Un\nTexte.\n\nDeux");
  });
});

describe("quoteIsInSource — on n'attribue pas une phrase jamais dite", () => {
  const source =
    "Alors voilà, j’ai tout perdu en 2019.\nEt c'est là que j'ai compris : le prix, ça rassure.";

  it("accepte le mot pour mot, malgré l'apostrophe, la casse et les retours", () => {
    expect(quoteIsInSource("J'ai tout perdu en 2019", source)).toBe(true);
    expect(quoteIsInSource("en 2019. Et c’est là que j’ai compris", source)).toBe(true);
  });

  it("refuse la reformulation, le milieu de mot et le trop court", () => {
    expect(quoteIsInSource("J'ai absolument tout perdu en 2019", source)).toBe(false);
    expect(quoteIsInSource("out perdu en 2019 et c'est", source)).toBe(false);
    expect(quoteIsInSource("le prix", source)).toBe(false);
    expect(quoteIsInSource("", source)).toBe(false);
  });

  it("marche en arabe", () => {
    const ar = "في الأول ما كنتش نعرف، توا نجّم نقول إلي السوم يطمّن الحريف.";
    expect(quoteIsInSource("توا نجّم نقول إلي السوم يطمّن", ar)).toBe(true);
    expect(quoteIsInSource("توا ما نجّمش نقول إلي السوم يطمّن", ar)).toBe(false);
  });
});
