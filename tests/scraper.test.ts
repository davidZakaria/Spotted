import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildScrapeInput, flattenScrapeItem, itemsToCsv, scrapeItemToMention, scrapeTool, SCRAPE_TOOLS } from "@/lib/scrape/tools";
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
        "linkedin-profiles",
        "linkedin-profile-posts",
        "linkedin-people",
        "tiktok",
        "youtube",
        "x",
        "maps",
        "ads",
        "advanced",
      ]),
    );
    expect(scrapeTool("linkedin")?.actorId).toBe("harvestapi/linkedin-company-posts");
    expect(scrapeTool("linkedin-profiles")?.actorId).toBe("harvestapi/linkedin-profile-scraper");
    expect(scrapeTool("linkedin-profile-posts")?.actorId).toBe("harvestapi/linkedin-profile-posts");
    expect(scrapeTool("linkedin-people")?.actorId).toBe("harvestapi/linkedin-profile-search");
    expect(scrapeTool("linkedin-profiles")?.helper).toMatch(/public/i);
    expect(scrapeTool("linkedin-people")?.helperAr).toMatch(/لينكدإن/);
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
    const profiles = buildScrapeInput("linkedin-profiles", {
      urls: "https://www.linkedin.com/in/someone\nhttps://www.linkedin.com/in/other",
    });
    expect(profiles.actorId).toBe("harvestapi/linkedin-profile-scraper");
    expect(profiles.input.urls).toHaveLength(2);
    const posts = buildScrapeInput("linkedin-profile-posts", {
      urls: "https://www.linkedin.com/in/someone",
      maxPosts: "8",
    });
    expect(posts.input.targetUrls).toEqual(["https://www.linkedin.com/in/someone"]);
    expect(posts.input.maxPosts).toBe(8);
    const people = buildScrapeInput("linkedin-people", {
      jobTitle: "Marketing Manager",
      company: "New Jersey Developments",
      location: "Cairo, Egypt",
      maxItems: "20",
    });
    expect(people.actorId).toBe("harvestapi/linkedin-profile-search");
    expect(people.input.currentJobTitles).toEqual(["Marketing Manager"]);
    expect(people.input.locations).toEqual(["Cairo, Egypt"]);
    expect(people.input.searchQuery).toBe("New Jersey Developments");
    expect(people.input.profileScraperMode).toBe("Short");
    expect(() => buildScrapeInput("linkedin-people", {})).toThrow(/job title/i);
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
    const profile = flattenScrapeItem({
      fullName: "Mona Ali",
      headline: "Marketing Manager",
      linkedinUrl: "https://www.linkedin.com/in/mona",
      location: { linkedinText: "Cairo, Egypt" },
      currentPosition: [{ companyName: "New Jersey Developments" }],
      experience: [{ position: "Marketing Manager", companyName: "New Jersey Developments" }],
      education: [{ schoolName: "AUC", degree: "BA" }],
      skills: ["PR", "Media"],
      about: "Works on Genesis",
      followerCount: 1200,
    });
    expect(profile.name).toBe("Mona Ali");
    expect(profile.location).toBe("Cairo, Egypt");
    expect(profile.company).toBe("New Jersey Developments");
    expect(profile.skills).toMatch(/PR/);
    expect(profile.followers).toBe(1200);
    const mapped = scrapeItemToMention(scrapeTool("linkedin-profiles")!, profile, 0);
    expect(mapped?.source).toBe("LINKEDIN");
    expect(mapped?.url).toContain("linkedin.com/in/mona");
    expect(mapped?.content).toMatch(/Genesis/);
  });

  it("explains a missing APIFY_TOKEN in plain language", () => {
    expect(hasApifyToken({})).toBe(false);
    expect(missingTokenMessage("en")).toMatch(/APIFY_TOKEN/);
    expect(missingTokenMessage("ar")).toMatch(/APIFY_TOKEN/);
    expect(readFileSync("src/app/app/scraper/page.tsx", "utf8")).toMatch(/startScrapeAction/);
    expect(readFileSync("src/lib/queue.ts", "utf8")).toMatch(/run-scraper/);
  });
});
