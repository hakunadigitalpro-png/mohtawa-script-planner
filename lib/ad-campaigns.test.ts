import { describe, expect, it } from "vitest";
import { adReadiness, isAdReady, parseBudget, summarizeCampaigns } from "./ad-campaigns";

describe("isAdReady", () => {
  it("il faut un visuel ou une vidéo, et un texte", () => {
    expect(isAdReady({ visual_url: "a.jpg", hook: "Texte" })).toBe(true);
    expect(isAdReady({ video_url: "https://youtu.be/x", hook: "Texte" })).toBe(true);
    expect(isAdReady({ visual_url: "a.jpg", hook: "  " })).toBe(false);
    expect(isAdReady({ hook: "Texte" })).toBe(false);
  });

  it("un carrousel n'est prêt que si toutes ses diapos le sont", () => {
    expect(
      isAdReady({ slides: [{ visual_url: "a", text: "1" }, { video_url: "b", text: "2" }] }),
    ).toBe(true);
    expect(
      isAdReady({ slides: [{ visual_url: "a", text: "1" }, { visual_url: null, text: "2" }] }),
    ).toBe(false);
  });

  it("compte sur tous les ad sets", () => {
    expect(
      adReadiness([
        { ads: [{ visual_url: "a", hook: "b" }, { hook: "b" }] },
        { ads: [{ visual_url: "a", hook: "b" }] },
      ]),
    ).toEqual({ ready: 2, total: 3 });
  });
});

describe("parseBudget", () => {
  it("lit ce qu'on écrit vraiment", () => {
    expect(parseBudget("300")).toBe(300);
    expect(parseBudget("1 200,50 TND")).toBe(1200.5);
    expect(parseBudget("1,500")).toBe(1500);
    expect(parseBudget("1.234.567")).toBe(1234567);
    expect(parseBudget("45.5")).toBe(45.5);
    expect(parseBudget("Budget : 90 $")).toBe(90);
  });

  it("n'invente rien", () => {
    expect(parseBudget("à définir")).toBeNull();
    expect(parseBudget("300-500")).toBeNull();
    expect(parseBudget("200 €/jour")).toBeNull();
    expect(parseBudget("")).toBeNull();
    expect(parseBudget(null)).toBeNull();
  });
});

describe("summarizeCampaigns", () => {
  it("n'additionne pas des devises différentes", () => {
    expect(
      summarizeCampaigns([
        { status: "live", budget_global: "100 TND" },
        { status: "live", budget_global: "50 €" },
      ]).budget,
    ).toBe(0);
    expect(
      summarizeCampaigns([
        { status: "live", budget_global: "100 DT" },
        { status: "live", budget_global: "50 TND" },
        { status: "live", budget_global: "25" },
      ]).budget,
    ).toBe(175);
  });

  it("additionne, sans le budget des campagnes arrêtées", () => {
    expect(
      summarizeCampaigns([
        { status: "live", budget_global: "100", reach: 10, clicks: 1, leads: 2 },
        { status: "stopped", budget_global: "999", reach: 5 },
        { status: "draft", budget_global: "à voir", review_state: "pending_review" },
      ]),
    ).toEqual({ count: 3, live: 1, awaitingClient: 1, budget: 100, reach: 15, clicks: 1, leads: 2 });
  });
});
