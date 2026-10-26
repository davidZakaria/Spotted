import { describe, expect, it } from "vitest";
import { analyzeSentimentLocal } from "@/lib/sentiment";
import { keepMention, ruleFromPhrase } from "@/lib/listen/query";
import { appendSerpExcludes, queryWordCount, SERP_QUERY_WORD_LIMIT } from "@/lib/listen/synonyms";
import {
  applyReviewSentiment,
  mentionFromMapsReview,
  parseMapsPlaceInput,
  pickCairoMapsPlace,
  placeIsDue,
} from "@/lib/listen/maps";
import { mentionFailsNewRules, NJD_CONTEXT_WHEN, NJD_CONTEXT_WORDS, NJD_EXCLUDE_WORDS, njdEnglishRule } from "@/lib/listen/njd";
import { serpBudgetLow } from "@/lib/listen/serpapi";
import { SOURCE_CATALOG } from "@/lib/connectors/catalog";

describe("Google Maps places and reviews", () => {
  it("reads a data_id or place id from a pasted Maps link", () => {
    const parsed = parseMapsPlaceInput(
      "https://www.google.com/maps/place/New+Jersey+Developments/@30.04,31.23,17z/data=!3m1!4b1!4m6!data_id=0x14583fa3:0xabc123",
    );
    expect(parsed.dataId).toMatch(/^0x/i);
    expect(parsed.query).toMatch(/New Jersey Developments/i);
    expect(parseMapsPlaceInput("ChIJN1t_tDeuEmsRUsoyG83frY4").placeId).toMatch(/^ChIJ/);
  });

  it("prefers a Cairo listing when resolving the office name", () => {
    const picked = pickCairoMapsPlace(
      [
        { title: "New Jersey diner", address: "Newark, NJ", data_id: "0x1:0x1" },
        { title: "New Jersey Developments", address: "Nasr City, Cairo, Egypt", data_id: "0x1458:0xcafe" },
      ],
      "New Jersey Developments",
    );
    expect(picked?.data_id).toBe("0x1458:0xcafe");
  });

  it("turns a 1-star review into a negative Complaints & risk mention", () => {
    const mention = mentionFromMapsReview(
      {
        review_id: "rev-1",
        rating: 1,
        snippet: "نصب وفشل",
        iso_date: "2026-10-01T00:00:00Z",
        user: { name: "Mona" },
        link: "https://maps.google.com/reviews/rev-1",
      },
      { label: "New Jersey Developments", mapsUrl: "https://maps.google.com/?cid=1", dataId: "0x1458:0xcafe" },
    );
    expect(mention?.source).toBe("GOOGLE_MAPS");
    expect(mention?.authorName).toBe("Mona");
    expect(mention?.rating).toBe(1);
    expect(mention?.externalId).toBe("rev-1");
    const scored = applyReviewSentiment(analyzeSentimentLocal(mention?.content ?? ""), mention?.rating);
    expect(scored.sentiment).toBe("NEGATIVE");
    expect(scored.complaint).toBe(true);
    expect(placeIsDue({ label: "Office", lastFetchedAt: new Date().toISOString() }, 24)).toBe(false);
    expect(placeIsDue({ label: "Office" }, 24)).toBe(true);
    expect(serpBudgetLow(8, 250)).toBe(true);
    expect(serpBudgetLow(80, 250)).toBe(false);
  });
});

describe("US New Jersey noise filters", () => {
  it("drops English-only New Jersey Development hits without Egypt context", () => {
    const rule = njdEnglishRule();
    expect(keepMention("New Jersey Developments opens a new township office", rule)).toBe(false);
    expect(keepMention("New Jersey Developments delayed Genesis in Cairo", rule)).toBe(true);
    expect(keepMention("متضررو نيو جيرسي في القاهرة", ruleFromPhrase("نيو جيرسي", { synonyms: NJD_CONTEXT_WHEN }))).toBe(true);
    expect(keepMention("Governor Murphy in Trenton", ruleFromPhrase("Acme"), NJD_EXCLUDE_WORDS)).toBe(false);
  });

  it("adds -\"term\" excludes to the SerpAPI query while staying under 32 words", () => {
    const packed = appendSerpExcludes("New Jersey Developments OR Genesis", NJD_EXCLUDE_WORDS);
    expect(packed).toContain('-"Jersey City"');
    expect(packed).toContain("-Trenton");
    expect(queryWordCount(packed)).toBeLessThanOrEqual(SERP_QUERY_WORD_LIMIT);
  });

  it("flags saved US noise such as a Bluesky politics post", () => {
    const keywords = [njdEnglishRule()];
    expect(
      mentionFailsNewRules({
        source: "BLUESKY",
        title: "leboism",
        content: "Governor Murphy visits Trenton — New Jersey Developments in the Garden State",
        keywords,
        excludeWords: NJD_EXCLUDE_WORDS,
      }),
    ).toBe(true);
    expect(
      mentionFailsNewRules({
        source: "GOOGLE_NEWS",
        title: "تأخير التسليم",
        content: "مشروع New Jersey Developments في العين السخنة",
        keywords,
        excludeWords: NJD_EXCLUDE_WORDS,
      }),
    ).toBe(false);
    expect(NJD_CONTEXT_WORDS).toContain("{arabic}");
    expect(NJD_CONTEXT_WHEN.some((term) => /NJ Developments/i.test(term))).toBe(true);
    expect(SOURCE_CATALOG.some((row) => row.id === "GOOGLE_MAPS")).toBe(true);
  });
});
