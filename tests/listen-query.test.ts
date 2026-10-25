import { describe, expect, it } from "vitest";
import { expandVariants, mentionMatches, ruleFromPhrase, searchQueries } from "@/lib/listen/query";
import { dedupeMentions, influenceScore, normalizeUrl } from "@/lib/listen/dedupe";
import { liveSourcePlan } from "@/lib/listen/sources";
import { SERPAPI_SCHEDULED_PER_KEYWORD, serpMonthlyLimit } from "@/lib/listen/serpapi";
import { newsEditionsFor } from "@/lib/connectors/google";
import { DEFAULT_RSS_FEEDS } from "@/lib/connectors/rss";

describe("keyword variants and boolean", () => {
  it("treats real-estate and real estate as the same watch word", () => {
    const variants = expandVariants("real-estate");
    expect(variants).toContain("real-estate");
    expect(variants).toContain("real estate");
    expect(variants).toContain("realestate");
    const rule = ruleFromPhrase("real-estate");
    expect(mentionMatches("Best real estate tips in Cairo", rule)).toBe(true);
    expect(mentionMatches("realestate boom", rule)).toBe(true);
    expect(mentionMatches("unrelated cooking video", rule)).toBe(false);
  });

  it("supports required, excluded, and Boolean AND/OR/NOT with quotes", () => {
    const rule = ruleFromPhrase("spotted", {
      requiredWords: ["cairo"],
      excludedWords: ["game"],
    });
    expect(mentionMatches("spotted in cairo today", rule)).toBe(true);
    expect(mentionMatches("spotted the game in cairo", rule)).toBe(false);
    expect(mentionMatches("spotted in london", rule)).toBe(false);

    const booleanRule = ruleFromPhrase("unused", {
      booleanQuery: '"real estate" AND (cairo OR egypt) NOT game',
    });
    expect(mentionMatches("real estate prices in cairo", booleanRule)).toBe(true);
    expect(mentionMatches("real estate game cairo", booleanRule)).toBe(false);
    expect(mentionMatches("real estate in paris", booleanRule)).toBe(false);
  });

  it("matches hyphen and space synonyms, including Arabic letter variants", () => {
    const rule = ruleFromPhrase("J-Communities", { synonyms: ["J Communities"] });
    expect(mentionMatches("Launch of J Communities this week", rule)).toBe(true);
    expect(mentionMatches("J-Communities is hiring", rule)).toBe(true);
    expect(mentionMatches("Welcome to JCommunities", rule)).toBe(true);
    expect(mentionMatches("unrelated cooking video", rule)).toBe(false);

    const arabic = ruleFromPhrase("إعلانات", { synonyms: ["اعلانات", "مجتمعات-ج"] });
    expect(mentionMatches("حملة اعلانات جديدة", arabic)).toBe(true);
    expect(mentionMatches("حديث عن مجتمعات ج اليوم", arabic)).toBe(true);
  });

  it("understands Arabic operators and letter variants", () => {
    const rule = ruleFromPhrase("عقارات", { booleanQuery: "عقارات و القاهرة ليس لعبة" });
    expect(mentionMatches("أسعار العقارات في القاهرة", rule)).toBe(true);
    expect(mentionMatches("لعبة عقارات في القاهرة", rule)).toBe(false);
    expect(mentionMatches("إعلانات اعلانية", ruleFromPhrase("إعلانات"))).toBe(true);
  });

  it("builds several search queries including hyphen variants", () => {
    const queries = searchQueries(ruleFromPhrase("real-estate", { synonyms: ["عقارات"] }));
    expect(queries.some((query) => query.includes("real estate") || query === "real estate")).toBe(true);
    expect(queries).toContain("عقارات");
  });
});

describe("dedupe and influence", () => {
  it("drops the same story arriving from two URLs", () => {
    const items = dedupeMentions([
      {
        source: "RSS",
        externalId: "1",
        url: "https://www.example.com/story?utm_source=rss",
        title: "Cairo real estate",
        content: "Prices rose",
        publishedAt: new Date(),
      },
      {
        source: "GOOGLE_NEWS",
        externalId: "2",
        url: "https://example.com/story",
        title: "Cairo real estate",
        content: "Prices rose",
        publishedAt: new Date(),
      },
    ]);
    expect(items).toHaveLength(1);
    expect(normalizeUrl("https://www.example.com/a/?utm_source=x")).toBe("https://example.com/a");
    expect(influenceScore({ reach: 10, engagement: 3, likeCount: 2 })).toBe(18);
  });
});

describe("live source honesty", () => {
  it("marks X, web search, TikTok, and Instagram as needing a key when missing", () => {
    const plan = liveSourcePlan({
      connected: [],
      env: {},
    });
    const byId = Object.fromEntries(plan.map((row) => [row.id, row]));
    expect(byId.REDDIT.ready).toBe(false);
    expect(byId.REDDIT.note).toMatch(/Google search/);
    expect(
      liveSourcePlan({ connected: [], env: { SERPAPI_API_KEY: "k" }, serpRemaining: 10 }).find((row) => row.id === "REDDIT")
        ?.ready,
    ).toBe(true);
    expect(byId.GOOGLE_NEWS.ready).toBe(true);
    expect(byId.YOUTUBE.ready).toBe(false);
    expect(byId.YOUTUBE.note).toMatch(/YOUTUBE_API_KEY/);
    expect(byId.X.ready).toBe(false);
    expect(byId.X.note).toMatch(/Add key to include/);
    expect(byId.WEB_SEARCH.note).toMatch(/Add key to include/);
    expect(byId.QUORA.ready).toBe(false);
    expect(byId.QUORA.note).toBe("Found through Google search");
    expect(byId.QUORA.note).not.toMatch(/needs a key/i);
    expect(byId.TIKTOK.note).toMatch(/Add key to include/);
    expect(byId.INSTAGRAM.note).toMatch(/Instagram/);
    expect(byId.YOUTUBE.ready).toBe(false);
    expect(liveSourcePlan({ connected: [], env: { YOUTUBE_API_KEY: "k" } }).find((row) => row.id === "YOUTUBE")?.ready).toBe(true);
  });
});

describe("SerpAPI budget", () => {
  it("defaults the monthly cap to 250 and allows a few scheduled refreshes per word", () => {
    expect(serpMonthlyLimit({})).toBe(250);
    expect(serpMonthlyLimit({ SERPAPI_MONTHLY_LIMIT: "100" })).toBe(100);
    expect(serpMonthlyLimit({ SERPAPI_MONTHLY_LIMIT: "nope" })).toBe(250);
    expect(SERPAPI_SCHEDULED_PER_KEYWORD).toBe(2);
  });

  it("turns web search off in the live plan when the monthly cap is spent", () => {
    const spent = liveSourcePlan({
      connected: [],
      env: { SERPAPI_API_KEY: "k" },
      serpRemaining: 0,
      serpLimit: 250,
    });
    const web = spent.find((row) => row.id === "WEB_SEARCH")!;
    expect(web.ready).toBe(false);
    expect(web.note).toMatch(/monthly limit reached/);
    const open = liveSourcePlan({
      connected: [],
      env: { SERPAPI_API_KEY: "k" },
      serpRemaining: 12,
      serpLimit: 250,
    });
    expect(open.find((row) => row.id === "WEB_SEARCH")?.ready).toBe(true);
    expect(open.find((row) => row.id === "WEB_SEARCH")?.note).toMatch(/12 SerpAPI/);
    expect(spent.find((row) => row.id === "QUORA")?.ready).toBe(false);
    expect(open.find((row) => row.id === "QUORA")?.ready).toBe(true);
  });
});

describe("wider news coverage", () => {
  it("includes Arabic Egypt editions and extra RSS feeds", () => {
    const arEg = newsEditionsFor("ar", "EG");
    expect(arEg.some((edition) => edition.gl === "EG" && edition.hl === "ar")).toBe(true);
    expect(newsEditionsFor("en").some((edition) => edition.gl === "US")).toBe(true);
    expect(DEFAULT_RSS_FEEDS.length).toBeGreaterThan(6);
    expect(DEFAULT_RSS_FEEDS.join(" ")).toMatch(/aljazeera|bbc/i);
  });
});
