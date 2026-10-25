import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BSKY_APPVIEWS } from "@/lib/connectors/bluesky";
import {
  labelRedditViaGoogle,
  redditOauthPath,
  redditSerpQuery,
  redditUserAgent,
  REDDIT_VIA_GOOGLE_NOTE,
} from "@/lib/connectors/reddit";
import { liveSourcePlan } from "@/lib/listen/sources";
import { mentionsFromSerpPayload } from "@/lib/listen/serpapi";

describe("Reddit compliance", () => {
  it("builds a SerpAPI site:reddit.com query and labels hits as Reddit (via Google)", () => {
    expect(redditSerpQuery("real-estate")).toBe("site:reddit.com real-estate");
    expect(redditSerpQuery("site:reddit.com already")).toBe("site:reddit.com already");
    const serp = mentionsFromSerpPayload(
      {
        organic_results: [
          {
            title: "r/RealEstate — prices",
            link: "https://www.reddit.com/r/RealEstate/comments/abc/prices",
            snippet: "real-estate discussion",
            date: "3 days ago",
          },
        ],
      },
      { engine: "google", query: "site:reddit.com real-estate", source: "REDDIT", fetchedAt: new Date() },
    );
    const labeled = labelRedditViaGoogle(serp);
    expect(labeled[0].source).toBe("REDDIT");
    expect(labeled[0].kind).toBe("via_google");
  });

  it("keeps the official OAuth path helper and does not ship public JSON hosts", () => {
    expect(redditOauthPath("/search.json?q=acme")).toBe("/search?q=acme");
    expect(redditUserAgent({ REDDIT_USER_AGENT: "web:spotted:1.0.0 (by /u/jane)" })).toBe(
      "web:spotted:1.0.0 (by /u/jane)",
    );
    const src = readFileSync("src/lib/connectors/reddit.ts", "utf8");
    expect(src).not.toMatch(/old\.reddit\.com/);
    expect(src).not.toMatch(/https:\/\/www\.reddit\.com\/search/);
    expect(src).not.toMatch(/redditPublicBases/);
    expect(src).toMatch(/oauth\.reddit\.com/);
    expect(src).toMatch(/hasRedditApp/);
    expect(src).toMatch(/site:reddit\.com/);
  });

  it("shows the Google-search card copy and is not ready without SerpAPI or approved keys", () => {
    expect(REDDIT_VIA_GOOGLE_NOTE).toBe(
      "Found through Google search. Direct Reddit access needs Reddit's approval.",
    );
    const empty = liveSourcePlan({ connected: [], env: {} }).find((row) => row.id === "REDDIT");
    expect(empty?.ready).toBe(false);
    expect(empty?.note).toBe(REDDIT_VIA_GOOGLE_NOTE);

    const viaGoogle = liveSourcePlan({
      connected: [],
      env: { SERPAPI_API_KEY: "k" },
      serpRemaining: 12,
    }).find((row) => row.id === "REDDIT");
    expect(viaGoogle?.ready).toBe(true);
    expect(viaGoogle?.note).toBe(REDDIT_VIA_GOOGLE_NOTE);

    const spent = liveSourcePlan({
      connected: [],
      env: { SERPAPI_API_KEY: "k" },
      serpRemaining: 0,
    }).find((row) => row.id === "REDDIT");
    expect(spent?.ready).toBe(false);

    const approved = liveSourcePlan({
      connected: [],
      env: { REDDIT_CLIENT_ID: "id", REDDIT_CLIENT_SECRET: "secret" },
    }).find((row) => row.id === "REDDIT");
    expect(approved?.ready).toBe(true);

    const card = readFileSync("src/lib/platforms.ts", "utf8");
    expect(card).toContain(REDDIT_VIA_GOOGLE_NOTE);
    expect(card).not.toMatch(/old\.reddit/);
  });
});

describe("Bluesky AppView hosts", () => {
  it("tries api.bsky.app before public.api.bsky.app", () => {
    expect(BSKY_APPVIEWS[0]).toBe("https://api.bsky.app");
    expect(BSKY_APPVIEWS).toContain("https://public.api.bsky.app");
  });
});
