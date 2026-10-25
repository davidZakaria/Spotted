import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BACKFILL_DAYS,
  BACKFILL_SOURCES,
  HISTORY_SCAN_KIND,
  HISTORY_SCAN_LABEL,
  INGEST_DAYS,
  lookbackSince,
  markHistoryScan,
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
