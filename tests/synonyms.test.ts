import { describe, expect, it } from "vitest";
import { forumSerpQuery, searchQueryCap } from "@/lib/listen/forum-serp";
import { backfillSerpQuery } from "@/lib/listen/backfill";
import { ruleFromPhrase, searchQueries } from "@/lib/listen/query";
import {
  FREE_SPLIT_QUERY_CAP,
  queryWordCount,
  selectSerpSynonyms,
  SERP_QUERY_WORD_LIMIT,
} from "@/lib/listen/synonyms";

function fortySynonyms() {
  return Array.from({ length: 40 }, (_, index) =>
    index % 2 === 0 ? `علامة${index}` : `BrandAlias${index}`,
  );
}

describe("SerpAPI synonym packing", () => {
  it("keeps one query under the 32-word Google limit and prefers distinct synonyms", () => {
    const rule = ruleFromPhrase("J-Communities", {
      synonyms: ["J Communities", "JCommunities", ...fortySynonyms()],
    });
    const packed = selectSerpSynonyms(rule, { rotateLeftovers: false, preferArabic: true });
    expect(packed.query.split(" OR ").length).toBeGreaterThan(1);
    expect(queryWordCount(packed.query)).toBeLessThanOrEqual(SERP_QUERY_WORD_LIMIT);
    expect(packed.selected[0]).toBe("J-Communities");
    expect(packed.selected.filter((term) => /j-?communities/i.test(term.replace(/\s+/g, "")))).toHaveLength(1);
    expect(packed.remaining.length).toBeGreaterThan(0);
    const backfill = backfillSerpQuery(rule);
    expect(backfill.query).toBe(packed.query);
    expect(queryWordCount(backfill.query)).toBeLessThanOrEqual(32);
  });

  it("rotates leftover synonyms across scheduled runs", () => {
    const rule = ruleFromPhrase("Acme", { synonyms: fortySynonyms() });
    const first = selectSerpSynonyms(rule, { rotation: 0, rotateLeftovers: true, preferArabic: true });
    const second = selectSerpSynonyms(rule, { rotation: 1, rotateLeftovers: true, preferArabic: true });
    expect(first.selected).toContain("Acme");
    expect(second.selected).toContain("Acme");
    expect(queryWordCount(first.query)).toBeLessThanOrEqual(32);
    expect(queryWordCount(second.query)).toBeLessThanOrEqual(32);
    const firstOnly = first.remaining.filter((term) => second.selected.includes(term));
    expect(firstOnly.length).toBeGreaterThan(0);
    expect(first.selected.join("|")).not.toBe(second.selected.join("|"));
  });

  it("splits free-source queries across the synonym list", () => {
    const rule = ruleFromPhrase("Acme", { synonyms: fortySynonyms() });
    const queries = searchQueries(rule, FREE_SPLIT_QUERY_CAP);
    expect(queries.length).toBeGreaterThanOrEqual(41);
    expect(queries[0]).toBe("Acme");
    expect(queries).toContain("علامة0");
    expect(queries).toContain("BrandAlias39");
    expect(searchQueryCap("GOOGLE_NEWS")).toBe(FREE_SPLIT_QUERY_CAP);
    expect(searchQueryCap("BLUESKY")).toBe(FREE_SPLIT_QUERY_CAP);
    expect(searchQueryCap("MASTODON")).toBe(FREE_SPLIT_QUERY_CAP);
    expect(searchQueryCap("HACKER_NEWS")).toBe(FREE_SPLIT_QUERY_CAP);
    expect(searchQueryCap("WEB_SEARCH")).toBe(1);
    expect(searchQueryCap("YOUTUBE")).toBe(2);
  });

  it("groups an OR synonym query when searching Reddit or Quora via Google", () => {
    expect(forumSerpQuery("Acme OR علامة0 OR BrandAlias1", ["reddit.com", "quora.com"])).toBe(
      "(site:reddit.com OR site:quora.com) (Acme OR علامة0 OR BrandAlias1)",
    );
  });
});
