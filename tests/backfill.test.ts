import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { newsEditionsFor } from "@/lib/connectors/google";
import { ruleFromPhrase } from "@/lib/listen/query";
import {
  BACKFILL_DAYS,
  BACKFILL_SOURCES,
  backfillSerpQuery,
  egyptNewsRssUrl,
  HISTORY_SCAN_KIND,
  HISTORY_SCAN_LABEL,
  INGEST_DAYS,
  lookbackSince,
  markHistoryScan,
  wantsArabicCoverage,
} from "@/lib/listen/backfill";

describe("historical backfill", () => {
  it("looks back 365 days and labels history-scan hits", () => {
    expect(BACKFILL_DAYS).toBe(365);
    expect(INGEST_DAYS).toBe(30);
    const since = lookbackSince(365, new Date("2026-10-25T00:00:00Z"));
    expect(since.toISOString().startsWith("2025-10-25")).toBe(true);
    const marked = markHistoryScan({
      source: "GOOGLE_NEWS",
      externalId: "1",
      url: "https://example.com/old",
      content: "old story",
      publishedAt: new Date("2025-12-01T00:00:00Z"),
      kind: "article",
    });
    expect(marked.kind).toBe(HISTORY_SCAN_KIND);
    expect(HISTORY_SCAN_LABEL).toBe("Found in history scan");
  });

  it("uses free sources fully and one untimed SerpAPI google query per keyword", () => {
    expect(BACKFILL_SOURCES).toEqual([
      "GOOGLE_NEWS",
      "HACKER_NEWS",
      "BLUESKY",
      "MASTODON",
      "YOUTUBE",
      "PODCASTS",
    ]);
    const ingest = readFileSync("src/lib/jobs/ingest.ts", "utf8");
    expect(ingest).toMatch(/purpose: "backfill"/);
    expect(ingest).toMatch(/limit: 100/);
    expect(ingest).toMatch(/engine: "google"/);
    expect(ingest).not.toMatch(/tbs/);
    const serp = readFileSync("src/lib/listen/serpapi.ts", "utf8");
    expect(serp).toMatch(/serpapi\.backfill/);
    expect(serp).toMatch(/Math\.min\(Math\.max\(input\.limit \?\? 10, 1\), 100\)/);
    expect(serp).not.toMatch(/tbs/);
    const google = readFileSync("src/lib/connectors/google.ts", "utf8");
    expect(google).toMatch(/purpose === "backfill"/);
    expect(google).not.toMatch(/when:7d/);
    expect(google).toMatch(/egyptNewsRssUrl|ceid=EG:ar|EGYPT_AR_EDITION/);
  });

  it("adds Arabic synonyms to one Egypt SerpAPI query and Egypt News RSS", () => {
    const rule = ruleFromPhrase("J-Communities", { synonyms: ["مجتمعات ج", "اعلانات"] });
    expect(wantsArabicCoverage(rule)).toBe(true);
    expect(wantsArabicCoverage(ruleFromPhrase("Acme"), { timezone: "Africa/Cairo" })).toBe(true);
    const planned = backfillSerpQuery(rule);
    expect(planned.query).toContain("OR");
    expect(planned.query).toContain("مجتمعات ج");
    expect(planned.country).toBe("eg");
    expect(planned.language).toBe("ar");
    expect(egyptNewsRssUrl("مجتمعات ج")).toBe(
      "https://news.google.com/rss/search?q=%D9%85%D8%AC%D8%AA%D9%85%D8%B9%D8%A7%D8%AA%20%D8%AC&hl=ar&gl=EG&ceid=EG:ar",
    );
    expect(newsEditionsFor("en", undefined, true).some((edition) => edition.gl === "EG" && edition.hl === "ar")).toBe(true);
    const mentions = readFileSync("src/app/app/mentions/page.tsx", "utf8");
    expect(mentions).toMatch(/Arabic/);
    expect(mentions).toMatch(/value="ar"/);
  });

  it("offers Search past year and shows Found in history scan", () => {
    const project = readFileSync("src/app/app/projects/[id]/page.tsx", "utf8");
    expect(project).toMatch(/Search past year/);
    expect(project).toMatch(/searchPastYearAction/);
    const mentions = readFileSync("src/app/app/mentions/page.tsx", "utf8");
    expect(mentions).toMatch(/Search past year/);
    const card = readFileSync("src/components/mention-card.tsx", "utf8");
    expect(card).toMatch(/HISTORY_SCAN_LABEL/);
    const actions = readFileSync("src/lib/actions.ts", "utf8");
    expect(actions).toMatch(/forceBackfill: true/);
  });
});
