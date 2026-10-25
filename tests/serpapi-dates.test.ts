import { describe, expect, it } from "vitest";
import { isValidDate, parsePublishedAt, parseRelativeDate, safeIso } from "@/lib/listen/dates";
import { mentionsFromSerpPayload } from "@/lib/listen/serpapi";
import { toLiveHit } from "@/lib/listen/live";
import type { RawMention } from "@/lib/connectors/types";

const FETCHED = new Date("2026-10-25T12:00:00.000Z");

const GOOGLE_ORGANIC_FIXTURE = {
  organic_results: [
    {
      position: 1,
      title: "Real Estate — Zillow",
      link: "https://www.zillow.com/",
      snippet: "Search real-estate listings nationwide.",
      date: "3 days ago",
    },
    {
      position: 2,
      title: "Housing market this week",
      link: "https://example.com/housing",
      snippet: "real estate prices rose",
      date: "2 hours ago",
    },
    {
      position: 3,
      title: "Yesterday’s closings",
      link: "https://example.com/yesterday",
      snippet: "real-estate closings",
      date: "Yesterday",
    },
    {
      position: 4,
      title: "No date listing",
      link: "https://example.com/nodate",
      snippet: "real estate brokers",
    },
    {
      position: 5,
      title: "Absolute date",
      link: "https://example.com/oct",
      snippet: "real-estate guide",
      date: "Oct 20, 2026",
    },
    {
      position: 6,
      title: "Broken date still usable",
      link: "https://example.com/bad",
      snippet: "real estate news",
      date: "not a real date at all",
    },
  ],
};

const GOOGLE_NEWS_FIXTURE = {
  news_results: [
    {
      title: "Cairo real-estate prices hold",
      link: "https://news.example.com/cairo",
      snippet: "real-estate demand in Cairo",
      date: "10/24/2026, 08:30 AM, +0000 UTC",
      source: { name: "Reuters" },
    },
    {
      title: "Hourly wrap",
      link: "https://news.example.com/hourly",
      snippet: "real estate briefing",
      date: "10 hours ago",
      source: "BBC",
    },
    {
      title: "Missing date article",
      link: "https://news.example.com/missing",
      snippet: "real-estate funds",
    },
  ],
};

describe("parsePublishedAt", () => {
  it("parses SerpAPI relative dates against the fetch time", () => {
    expect(parsePublishedAt("3 days ago", FETCHED).toISOString()).toBe("2026-10-22T12:00:00.000Z");
    expect(parsePublishedAt("2 hours ago", FETCHED).toISOString()).toBe("2026-10-25T10:00:00.000Z");
    expect(parsePublishedAt("1 week ago", FETCHED).toISOString()).toBe("2026-10-18T12:00:00.000Z");
    expect(parsePublishedAt("a day ago", FETCHED).toISOString()).toBe("2026-10-24T12:00:00.000Z");
    expect(parsePublishedAt("Yesterday", FETCHED).toISOString()).toBe("2026-10-24T12:00:00.000Z");
    expect(parsePublishedAt("today", FETCHED).toISOString()).toBe(FETCHED.toISOString());
  });

  it("falls back to fetch time for missing or unparseable values", () => {
    expect(parsePublishedAt(undefined, FETCHED).toISOString()).toBe(FETCHED.toISOString());
    expect(parsePublishedAt("", FETCHED).toISOString()).toBe(FETCHED.toISOString());
    expect(parsePublishedAt("not a real date at all", FETCHED).toISOString()).toBe(FETCHED.toISOString());
    expect(parsePublishedAt(new Date("nope"), FETCHED).toISOString()).toBe(FETCHED.toISOString());
  });

  it("parses SerpAPI Google News UTC stamps that native Date rejects", () => {
    const parsed = parsePublishedAt("10/24/2026, 08:30 AM, +0000 UTC", FETCHED);
    expect(isValidDate(parsed)).toBe(true);
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(9);
    expect(safeIso(new Date("3 days ago"), FETCHED)).toBe(FETCHED.toISOString());
  });

  it("parseRelativeDate returns null for absolute strings", () => {
    expect(parseRelativeDate("Oct 20, 2026")).toBeNull();
  });
});

describe("SerpAPI fixtures", () => {
  it("maps google organic results with relative, missing, and broken dates", () => {
    const mentions = mentionsFromSerpPayload(GOOGLE_ORGANIC_FIXTURE, {
      engine: "google",
      query: "real-estate",
      source: "WEB_SEARCH",
      fetchedAt: FETCHED,
    });
    expect(mentions).toHaveLength(6);
    expect(mentions.every((row) => isValidDate(row.publishedAt))).toBe(true);
    expect(mentions[0].publishedAt.toISOString()).toBe("2026-10-22T12:00:00.000Z");
    expect(mentions[1].publishedAt.toISOString()).toBe("2026-10-25T10:00:00.000Z");
    expect(mentions[3].publishedAt.toISOString()).toBe(FETCHED.toISOString());
    expect(mentions[5].publishedAt.toISOString()).toBe(FETCHED.toISOString());
    expect(() => mentions.map((row) => row.publishedAt.toISOString())).not.toThrow();
  });

  it("maps google_news results including string sources and +0000 UTC dates", () => {
    const mentions = mentionsFromSerpPayload(GOOGLE_NEWS_FIXTURE, {
      engine: "google_news",
      query: "real-estate",
      source: "GOOGLE_NEWS",
      fetchedAt: FETCHED,
    });
    expect(mentions).toHaveLength(3);
    expect(mentions[0].authorName).toBe("Reuters");
    expect(mentions[1].authorName).toBe("BBC");
    expect(mentions.every((row) => isValidDate(row.publishedAt))).toBe(true);
    expect(mentions[1].publishedAt.toISOString()).toBe("2026-10-25T02:00:00.000Z");
    expect(mentions[2].publishedAt.toISOString()).toBe(FETCHED.toISOString());
  });

  it("never throws Invalid time value when turning fixtures into live hits", async () => {
    const mentions = mentionsFromSerpPayload(GOOGLE_ORGANIC_FIXTURE, {
      engine: "google",
      query: "real-estate",
      source: "WEB_SEARCH",
      fetchedAt: FETCHED,
    });
    const hits = [];
    for (const mention of mentions) hits.push(await toLiveHit(mention));
    expect(hits).toHaveLength(6);
    expect(hits.every((hit) => !Number.isNaN(Date.parse(hit.publishedAt)))).toBe(true);
  });

  it("skips a single broken row instead of failing the source", () => {
    const mentions = mentionsFromSerpPayload(
      {
        organic_results: [
          { title: "Good", link: "https://ok.example", snippet: "real estate", date: "1 day ago" },
          { title: "Also good", link: "https://also.example", snippet: "real-estate", date: undefined },
        ],
      },
      { engine: "google", query: "real-estate", source: "WEB_SEARCH", fetchedAt: FETCHED },
    );
    expect(mentions).toHaveLength(2);
  });
});

describe("App Store and Facebook date fallbacks", () => {
  it("accepts iTunes releaseDate and Graph created_time, and falls back otherwise", () => {
    expect(parsePublishedAt("2024-03-15T07:00:00Z", FETCHED).toISOString()).toBe("2024-03-15T07:00:00.000Z");
    expect(parsePublishedAt("2026-10-20T09:11:12+0000", FETCHED).getUTCDate()).toBe(20);
    expect(parsePublishedAt(undefined, FETCHED).toISOString()).toBe(FETCHED.toISOString());
  });

  it("toLiveHit survives an Invalid Date already sitting on a mention", async () => {
    const mention: RawMention = {
      source: "APP_STORE",
      externalId: "1",
      url: "https://apps.apple.com/app/id1",
      title: "Real Estate App",
      content: "Find real-estate listings",
      publishedAt: new Date("3 days ago"),
    };
    expect(Number.isNaN(mention.publishedAt.getTime())).toBe(true);
    const hit = await toLiveHit({ ...mention, publishedAt: parsePublishedAt(mention.publishedAt, FETCHED) });
    expect(hit.publishedAt).toBe(FETCHED.toISOString());
  });
});
