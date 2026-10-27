import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildScrapeInput, itemsToCsv, scrapeItemToMention, scrapeTool, SCRAPE_TOOLS } from "@/lib/scrape/tools";
import { hasApifyToken, missingTokenMessage } from "@/lib/scrape/apify";

describe("scraper tools", () => {
  it("lists marketer-ready tools including advanced Apify", () => {
    const ids = SCRAPE_TOOLS.map((tool) => tool.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "website",
        "google",
        "facebook-posts",
        "facebook-comments",
        "facebook-groups",
        "instagram",
        "linkedin",
        "tiktok",
        "youtube",
        "x",
        "maps",
        "ads",
        "advanced",
      ]),
    );
    expect(scrapeTool("linkedin")?.actorId).toBe("harvestapi/linkedin-company-posts");
    expect(scrapeTool("website")?.helper).toMatch(/public text/i);
  });

  it("builds actor input from a simple form", () => {
    const google = buildScrapeInput("google", { queries: "New Jersey Developments\nGenesis", country: "eg" });
    expect(google.actorId).toBe("apify/google-search-scraper");
    expect(google.input.queries).toEqual(["New Jersey Developments", "Genesis"]);
    const advanced = buildScrapeInput("advanced", {
      actorId: "apify/web-scraper",
      json: JSON.stringify({ startUrls: [{ url: "https://example.com" }] }),
    });
    expect(advanced.actorId).toBe("apify/web-scraper");
    expect(() => buildScrapeInput("advanced", { actorId: "x", json: "{bad" })).toThrow(/JSON/);
  });

  it("maps a result row to a mention and exports CSV for Excel", () => {
    const tool = scrapeTool("website")!;
    const mention = scrapeItemToMention(
      tool,
      { url: "https://example.com/post", title: "Office", text: "Delayed handover", authorName: "Mona" },
      0,
    );
    expect(mention?.source).toBe("WEB_SEARCH");
    expect(mention?.kind).toBe("scrape");
    expect(mention?.content).toMatch(/Delayed/);
    const csv = itemsToCsv([{ title: "Office", url: "https://example.com/post" }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("title");
    expect(csv).toContain("Office");
  });

  it("explains a missing APIFY_TOKEN in plain language", () => {
    expect(hasApifyToken({})).toBe(false);
    expect(missingTokenMessage("en")).toMatch(/APIFY_TOKEN/);
    expect(missingTokenMessage("ar")).toMatch(/APIFY_TOKEN/);
    expect(readFileSync("src/app/app/scraper/page.tsx", "utf8")).toMatch(/startScrapeAction/);
    expect(readFileSync("src/lib/queue.ts", "utf8")).toMatch(/run-scraper/);
  });
});
