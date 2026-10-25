import { describe, expect, it } from "vitest";
import { metaAuthorizeUrl, socialRowsFromPages, threadsAuthorizeUrl } from "@/lib/connectors/meta-oauth";
import { resolveFacebookPages } from "@/lib/connectors/meta";
import { mergeConnectedSources, pageIdsFromAccounts } from "@/lib/jobs/ingest";
import { oauthRedirect } from "@/lib/config";

describe("Meta OAuth mapping", () => {
  it("stores each Page token plus the linked Instagram business account", () => {
    const rows = socialRowsFromPages(
      "ws1",
      [
        {
          id: "page-1",
          name: "Acme",
          access_token: "page-tok",
          instagram_business_account: { id: "ig-1", username: "acme" },
        },
        { id: "page-2", name: "Acme Careers", access_token: "page-tok-2" },
      ],
      "user-tok",
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      workspaceId: "ws1",
      platform: "FACEBOOK",
      externalId: "page-1",
      accessToken: "page-tok",
      refreshToken: "user-tok",
      displayName: "Acme",
    });
    expect(rows[1]).toMatchObject({
      platform: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "page-tok",
      handle: "acme",
      metadata: { kind: "ig_business", pageId: "page-1" },
    });
    expect(rows[2]).toMatchObject({ platform: "FACEBOOK", externalId: "page-2" });
  });

  it("builds the Facebook dialog against APP_URL, not the request host", () => {
    const previous = process.env.APP_URL;
    process.env.APP_URL = "https://spottedg.duckdns.org";
    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      expect(oauthRedirect("meta")).toBe("https://spottedg.duckdns.org/api/oauth/meta/callback");
      const url = metaAuthorizeUrl("state-1", "app-123");
      expect(url).toContain("https://www.facebook.com/");
      expect(url).toContain("dialog/oauth");
      expect(url).toContain("client_id=app-123");
      expect(url).toContain(encodeURIComponent("https://spottedg.duckdns.org/api/oauth/meta/callback"));
      expect(url).toContain("pages_show_list");
      expect(threadsAuthorizeUrl("state-1", "th-1")).toContain("threads.net/oauth/authorize");
    } finally {
      if (previous == null) delete process.env.APP_URL;
      else process.env.APP_URL = previous;
    }
  });
});

describe("Facebook ingest helpers", () => {
  it("uses the connected Page id and its own token", () => {
    const pages = resolveFacebookPages({
      accessToken: "page-tok",
      accountExternalId: "111",
      projectConfig: { facebookPageIds: ["111", "999"] },
    });
    expect(pages).toEqual([
      { id: "111", token: "page-tok" },
      { id: "999", token: "page-tok" },
    ]);
  });

  it("adds connected Facebook and Instagram to ingest sources", () => {
    const sources = mergeConnectedSources(["REDDIT"], [
      { platform: "FACEBOOK", isMock: false, externalId: "p1" },
      { platform: "INSTAGRAM", isMock: true, externalId: "ig-mock" },
    ]);
    expect(sources).toContain("FACEBOOK");
    expect(sources).not.toContain("INSTAGRAM");
    expect(pageIdsFromAccounts(["keep"], [{ platform: "FACEBOOK", isMock: false, externalId: "p1" }], "FACEBOOK")).toEqual([
      "keep",
      "p1",
    ]);
  });
});
