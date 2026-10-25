import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Mentions live search UI", () => {
  it("runs a live query instead of only filtering stored mentions", () => {
    const page = readFileSync(resolve("src/app/app/mentions/page.tsx"), "utf8");
    expect(page).toMatch(/LiveSearch/);
    expect(page).toMatch(/Search everywhere for/);
    expect(page).toMatch(/influenceScore/);
    expect(page).toMatch(/shareOfVoice/);
    const live = readFileSync(resolve("src/components/live-search.tsx"), "utf8");
    expect(live).toMatch(/EventSource/);
    expect(live).toMatch(/\/api\/listen\/live/);
    expect(live).toMatch(/Keep watching this word/);
    expect(live).toMatch(/Searching \$\{row\.name\}/);
    const api = readFileSync(resolve("src/app/api/listen/live/route.ts"), "utf8");
    expect(api).toMatch(/text\/event-stream/);
    expect(api).toMatch(/runLiveSearch/);
    expect(page).toMatch(/serpUsageSummary/);
    expect(readFileSync(resolve("src/lib/connectors/websearch.ts"), "utf8")).toMatch(/runSerpSearch/);
    expect(readFileSync(resolve("src/lib/connectors/google.ts"), "utf8")).toMatch(/google_news/);
    expect(readFileSync(resolve("src/lib/listen/serpapi.ts"), "utf8")).toMatch(/SERPAPI_MONTHLY_LIMIT/);
  });

  it("refreshes tracked keywords every few minutes", () => {
    const queue = readFileSync(resolve("src/lib/queue.ts"), "utf8");
    expect(queue).toMatch(/5 \* 60 \* 1000/);
    const ingest = readFileSync(resolve("src/lib/jobs/ingest.ts"), "utf8");
    expect(ingest).toMatch(/INGEST_DAYS/);
    expect(ingest).toMatch(/lookbackSince/);
    expect(ingest).toMatch(/searchQueries/);
  });
});
