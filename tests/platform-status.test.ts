import { describe, expect, it } from "vitest";
import {
  describeConnection,
  hasAppKeys,
  hasGoogleOAuth,
  hasMetaAppKeys,
  hasYoutubeApiKey,
  oauthPathFor,
} from "@/lib/platform-status";
import { oauthErrorCopy, logOauth } from "@/lib/oauth-errors";

describe("connection badges", () => {
  it("says Connected as the Page name, not merely that keys exist", () => {
    const view = describeConnection({
      platform: "FACEBOOK",
      keyless: false,
      hasAppKeys: true,
      accounts: [{ platform: "FACEBOOK", displayName: "Acme Page", isMock: false }],
    });
    expect(view.kind).toBe("connected");
    expect(view.badge).toBe("Connected as Acme Page");
    expect(view.showConnect).toBe(true);
  });

  it("says Ready to connect when Meta keys exist but no Page is linked", () => {
    const view = describeConnection({
      platform: "FACEBOOK",
      keyless: false,
      hasAppKeys: true,
      accounts: [],
    });
    expect(view.kind).toBe("ready");
    expect(view.badge).toBe("Ready to connect");
    expect(view.showConnect).toBe(true);
  });

  it("says Needs setup when Facebook keys are missing, and still offers Connect", () => {
    const view = describeConnection({
      platform: "FACEBOOK",
      keyless: false,
      hasAppKeys: false,
      accounts: [],
    });
    expect(view.kind).toBe("needs_setup");
    expect(view.badge).toBe("Needs setup");
    expect(view.showConnect).toBe(true);
  });

  it("marks YouTube Working with no Connect when only an API key is set", () => {
    const view = describeConnection({
      platform: "YOUTUBE",
      keyless: false,
      hasAppKeys: true,
      accounts: [],
      youtubeSearchWorks: true,
      youtubeOAuthReady: false,
    });
    expect(view.kind).toBe("working");
    expect(view.badge).toBe("Working");
    expect(view.showConnect).toBe(false);
  });

  it("offers YouTube Connect only when a Google OAuth client is configured", () => {
    const view = describeConnection({
      platform: "YOUTUBE",
      keyless: false,
      hasAppKeys: true,
      accounts: [],
      youtubeSearchWorks: true,
      youtubeOAuthReady: true,
    });
    expect(view.kind).toBe("ready");
    expect(view.showConnect).toBe(true);
    expect(oauthPathFor("YOUTUBE")).toBe("/api/oauth/google");
  });

  it("treats web search keys as Working, not Connected", () => {
    const view = describeConnection({
      platform: "WEB_SEARCH",
      keyless: false,
      hasAppKeys: true,
      accounts: [],
    });
    expect(view.kind).toBe("working");
    expect(view.showConnect).toBe(false);
  });

  it("reads Meta / Google / YouTube env honestly", () => {
    expect(hasMetaAppKeys({ META_APP_ID: "1" })).toBe(false);
    expect(hasMetaAppKeys({ META_APP_ID: "1", META_APP_SECRET: "s" })).toBe(true);
    expect(hasYoutubeApiKey({ YOUTUBE_API_KEY: "k" })).toBe(true);
    expect(hasGoogleOAuth({ GOOGLE_OAUTH_CLIENT_ID: "id" })).toBe(false);
    expect(hasGoogleOAuth({ GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "sec" })).toBe(true);
    expect(hasAppKeys("FACEBOOK", { META_APP_ID: "1", META_APP_SECRET: "s" })).toBe(true);
    expect(hasAppKeys("THREADS", { THREADS_APP_ID: "t" })).toBe(false);
    expect(oauthPathFor("THREADS")).toBe("/api/oauth/threads");
    expect(oauthPathFor("FACEBOOK")).toBe("/api/oauth/meta");
  });
});

describe("oauth error copy", () => {
  it("explains missing Facebook keys in plain English", () => {
    expect(oauthErrorCopy("missing_meta_keys")).toMatch(/Facebook app keys are missing/);
    expect(oauthErrorCopy("no_pages")).toMatch(/no Pages/);
    expect(oauthErrorCopy("missing_google_oauth")).toMatch(/YouTube search already works/);
  });

  it("strips tokens from oauth logs", () => {
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    try {
      logOauth("exchange", { provider: "meta", access_token: "SECRET", pageCount: 2 });
    } finally {
      console.error = original;
    }
    expect(JSON.stringify(errors)).toContain("pageCount");
    expect(JSON.stringify(errors)).not.toContain("SECRET");
  });
});
