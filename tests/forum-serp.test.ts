import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forumSerpQuery,
  forumSitesFor,
  QUORA_VIA_GOOGLE_NOTE,
  resetForumSerpCache,
  searchForumsViaGoogle,
  searchQueryCap,
  splitForumMentions,
} from "@/lib/listen/forum-serp";
import { liveSourcePlan } from "@/lib/listen/sources";
import type { RawMention } from "@/lib/connectors/types";

function mention(url: string, title: string): RawMention {
  return {
    source: "WEB_SEARCH",
    externalId: url,
    url,
    title,
    content: title,
    publishedAt: new Date("2026-10-01T00:00:00Z"),
    kind: "web",
  };
}

afterEach(() => {
  resetForumSerpCache();
});

describe("forum SerpAPI query and split", () => {
  it("builds a combined Reddit + Quora site query", () => {
    expect(forumSerpQuery("real-estate", ["reddit.com"])).toBe("site:reddit.com real-estate");
    expect(forumSerpQuery("real-estate", ["quora.com"])).toBe("site:quora.com real-estate");
    expect(forumSerpQuery("real-estate", ["reddit.com", "quora.com"])).toBe(
      "(site:reddit.com OR site:quora.com) real-estate",
    );
    expect(forumSerpQuery("site:quora.com already", ["quora.com"])).toBe("site:quora.com already");
  });

  it("includes both sites when only SerpAPI is set, and drops the preferred provider", () => {
    expect(forumSitesFor("reddit.com", { SERPAPI_API_KEY: "k" })).toEqual(["reddit.com", "quora.com"]);
    expect(forumSitesFor("quora.com", { SERPAPI_API_KEY: "k" })).toEqual(["reddit.com", "quora.com"]);
    expect(forumSitesFor("reddit.com", { SERPAPI_API_KEY: "k", BRAVE_SEARCH_API_KEY: "b" })).toEqual(["reddit.com"]);
    expect(
      forumSitesFor("quora.com", {
        SERPAPI_API_KEY: "k",
        REDDIT_CLIENT_ID: "id",
        REDDIT_CLIENT_SECRET: "secret",
      }),
    ).toEqual(["quora.com"]);
    expect(forumSitesFor("quora.com", { BRAVE_SEARCH_API_KEY: "b" })).toEqual([]);
  });

  it("splits Google hits by domain and labels them via Google", () => {
    const split = splitForumMentions([
      mention("https://www.reddit.com/r/RealEstate/comments/abc/prices", "reddit thread"),
      mention("https://www.quora.com/What-is-real-estate", "quora question"),
      mention("https://example.com/blog", "unrelated"),
    ]);
    expect(split.reddit).toHaveLength(1);
    expect(split.reddit[0].source).toBe("REDDIT");
    expect(split.reddit[0].kind).toBe("via_google");
    expect(split.quora).toHaveLength(1);
    expect(split.quora[0].source).toBe("QUORA");
    expect(split.quora[0].kind).toBe("via_google");
  });
});

describe("combined forum SerpAPI search", () => {
  it("runs one Google query and splits Reddit vs Quora", async () => {
    const run = vi.fn(async () => ({
      mentions: [
        mention("https://www.reddit.com/r/RealEstate/comments/abc/prices", "reddit thread"),
        mention("https://www.quora.com/What-is-real-estate", "quora question"),
      ],
      remaining: 10,
    }));
    const ctx = {
      query: "real-estate",
      workspaceId: "ws-1",
      purpose: "live" as const,
      keywordKey: "real-estate",
    };
    const env = { SERPAPI_API_KEY: "k" };
    const reddit = await searchForumsViaGoogle(ctx, "reddit.com", { run, env });
    const quora = await searchForumsViaGoogle(ctx, "quora.com", { run, env });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0].query).toBe("(site:reddit.com OR site:quora.com) real-estate");
    expect(run.mock.calls[0][0].engine).toBe("google");
    expect(reddit).toHaveLength(1);
    expect(reddit[0].source).toBe("REDDIT");
    expect(quora).toHaveLength(1);
    expect(quora[0].source).toBe("QUORA");
  });

  it("keeps Brave as the preferred Quora provider and searches Reddit alone", async () => {
    const run = vi.fn(async () => ({
      mentions: [mention("https://old.reddit.com/r/x/comments/1", "r")],
      remaining: 9,
    }));
    await searchForumsViaGoogle(
      { query: "acme", workspaceId: "ws-1", purpose: "live", keywordKey: "acme" },
      "reddit.com",
      { run, env: { SERPAPI_API_KEY: "k", BRAVE_SEARCH_API_KEY: "brave" } },
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0].query).toBe("site:reddit.com acme");
  });
});

describe("Quora live plan and cards", () => {
  it("is ready with SerpAPI and says Found through Google search, not needs a key", () => {
    expect(QUORA_VIA_GOOGLE_NOTE).toBe("Found through Google search");
    const empty = liveSourcePlan({ connected: [], env: {} }).find((row) => row.id === "QUORA");
    expect(empty?.ready).toBe(false);
    expect(empty?.note).toBe(QUORA_VIA_GOOGLE_NOTE);
    expect(empty?.note).not.toMatch(/needs a key/i);
    expect(empty?.note).not.toMatch(/BRAVE_SEARCH_API_KEY/);

    const viaGoogle = liveSourcePlan({
      connected: [],
      env: { SERPAPI_API_KEY: "k" },
      serpRemaining: 12,
    }).find((row) => row.id === "QUORA");
    expect(viaGoogle?.ready).toBe(true);
    expect(viaGoogle?.note).toBe(QUORA_VIA_GOOGLE_NOTE);

    const spent = liveSourcePlan({
      connected: [],
      env: { SERPAPI_API_KEY: "k" },
      serpRemaining: 0,
    }).find((row) => row.id === "QUORA");
    expect(spent?.ready).toBe(false);

    const brave = liveSourcePlan({
      connected: [],
      env: { BRAVE_SEARCH_API_KEY: "b" },
    }).find((row) => row.id === "QUORA");
    expect(brave?.ready).toBe(true);
    expect(brave?.note).toBeUndefined();
  });

  it("uses one SerpAPI query for Reddit and Quora, and prefers official Reddit", () => {
    expect(searchQueryCap("QUORA")).toBe(1);
    expect(searchQueryCap("REDDIT", { SERPAPI_API_KEY: "k" })).toBe(1);
    expect(searchQueryCap("REDDIT", { REDDIT_CLIENT_ID: "id", REDDIT_CLIENT_SECRET: "secret" })).toBe(6);
    expect(searchQueryCap("WEB_SEARCH")).toBe(1);
  });

  it("ships Found through Google search on the Quora card and prefers Brave in the connector", () => {
    const card = readFileSync("src/lib/platforms.ts", "utf8");
    expect(card).toContain(QUORA_VIA_GOOGLE_NOTE);
    expect(card).not.toMatch(/Add key to include \(BRAVE_SEARCH_API_KEY\)/);
    const quora = readFileSync("src/lib/connectors/websearch.ts", "utf8");
    expect(quora).toMatch(/BRAVE_SEARCH_API_KEY/);
    expect(quora).toMatch(/searchForumsViaGoogle/);
    expect(quora).toMatch(/SERPAPI_API_KEY/);
    const reddit = readFileSync("src/lib/connectors/reddit.ts", "utf8");
    expect(reddit).toMatch(/searchForumsViaGoogle/);
  });
});
