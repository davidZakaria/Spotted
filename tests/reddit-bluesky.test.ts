import { describe, expect, it } from "vitest";
import { BSKY_APPVIEWS } from "@/lib/connectors/bluesky";
import { redditOauthPath, redditPublicBases, redditUserAgent } from "@/lib/connectors/reddit";

describe("Reddit hosts and User-Agent", () => {
  it("uses a Reddit-style User-Agent and prefers old.reddit.com", () => {
    expect(redditUserAgent({})).toMatch(/web:spotted-listener:1\.0\.0 \(by \/u\/spotted_app\)/);
    expect(redditUserAgent({ REDDIT_USER_AGENT: "web:spotted:1.0.0 (by /u/jane)" })).toBe(
      "web:spotted:1.0.0 (by /u/jane)",
    );
    expect(redditPublicBases()[0]).toBe("https://old.reddit.com");
    expect(redditPublicBases()).toContain("https://www.reddit.com");
    expect(redditOauthPath("/search.json?q=acme")).toBe("/search?q=acme");
    expect(redditOauthPath("/r/test/new.json")).toBe("/r/test/new");
  });
});

describe("Bluesky AppView hosts", () => {
  it("tries api.bsky.app before public.api.bsky.app", () => {
    expect(BSKY_APPVIEWS[0]).toBe("https://api.bsky.app");
    expect(BSKY_APPVIEWS).toContain("https://public.api.bsky.app");
  });
});
