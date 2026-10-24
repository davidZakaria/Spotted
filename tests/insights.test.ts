import { describe, expect, it } from "vitest";
import { biggestSpike, homeHeadline, keywordSuggestions, sentimentMood } from "@/lib/insights";

describe("marketer-facing insights", () => {
  it("describes sentiment in plain language", () => {
    expect(sentimentMood({ positive: 8, neutral: 2, negative: 1 }).key).toBe("positive");
    expect(sentimentMood({ positive: 1, neutral: 1, negative: 6 }).en).toMatch(/negative/i);
    expect(sentimentMood({ positive: 0, neutral: 0, negative: 0 }).key).toBe("none");
  });

  it("finds the busiest day", () => {
    const spike = biggestSpike([
      { date: "2026-10-20", volume: 2 },
      { date: "2026-10-22", volume: 11 },
      { date: "2026-10-23", volume: 4 },
    ]);
    expect(spike?.date).toBe("2026-10-22");
    expect(spike?.volume).toBe(11);
  });

  it("writes a Home sentence a marketer can read", () => {
    const text = homeHeadline({
      todayCount: 12,
      weekCount: 40,
      mood: sentimentMood({ positive: 20, neutral: 5, negative: 2 }),
      spike: { date: "2026-10-22", volume: 11 },
      locale: "en",
    });
    expect(text).toMatch(/12 new mentions today/);
    expect(text).toMatch(/mostly positive/);
    expect(text).not.toMatch(/ingest|connector|BullMQ|env var/i);
  });

  it("suggests watch words from a brand name", () => {
    expect(keywordSuggestions("Acme")).toContain("Acme");
    expect(keywordSuggestions("Acme")).toContain("Acme review");
  });
});
