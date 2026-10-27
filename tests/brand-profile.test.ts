import { describe, expect, it } from "vitest";
import { analyzeSentimentLocal } from "@/lib/sentiment";
import { brandHealth, mentionRoles, profileSerpExtras, readBrandProfile } from "@/lib/listen/profile";
import { appendSerpExcludes, queryWordCount, selectSerpSynonyms, SERP_QUERY_WORD_LIMIT } from "@/lib/listen/synonyms";
import { searchQueries, ruleFromPhrase } from "@/lib/listen/query";
import { FREE_SPLIT_QUERY_CAP } from "@/lib/listen/synonyms";

describe("brand profile", () => {
  it("forces user-negative words to Complaints & risk and lifts user-positive words", () => {
    const lexicon = { negative: ["never handed over", "ما سلمش"], positive: ["handed over on time", "التسليم تمام"] };
    const bad = analyzeSentimentLocal("The unit was never handed over to us", lexicon);
    expect(bad.sentiment).toBe("NEGATIVE");
    expect(bad.complaint).toBe(true);
    const ar = analyzeSentimentLocal("الشقة ما سلمش والناس زهقت", lexicon);
    expect(ar.sentiment).toBe("NEGATIVE");
    expect(ar.complaint).toBe(true);
    const good = analyzeSentimentLocal("They handed over on time, quiet note", lexicon);
    expect(good.sentiment).toBe("POSITIVE");
  });

  it("tags own, competitor, person, and product mentions", () => {
    const profile = readBrandProfile({
      officialAccounts: [{ label: "njd", handle: "njd", url: "https://facebook.com/njd" }],
      websites: ["https://njdevelopments.com"],
      competitors: ["Palm Hills"],
      spokespeople: ["Ahmed Fathy"],
      products: ["Genesis"],
      hashtags: ["#njd"],
    });
    expect(
      mentionRoles(
        { authorHandle: "njd", url: "https://facebook.com/njd/posts/1", content: "Office hours" },
        profile,
      ),
    ).toContain("own");
    expect(mentionRoles({ content: "Palm Hills delayed a launch", url: "https://x.com/x" }, profile)).toContain("competitor");
    expect(mentionRoles({ content: "Ahmed Fathy spoke today", url: "https://x.com/x" }, profile)).toContain("person");
    expect(mentionRoles({ content: "Genesis phase two #njd", url: "https://x.com/x" }, profile)).toContain("product");
  });

  it("asks for at least 3 negative words in brand health", () => {
    const health = brandHealth(readBrandProfile({ negativeWords: ["scam"] }), 0);
    expect(health.items.find((item) => item.id === "negative")?.ok).toBe(false);
    expect(health.items.find((item) => item.id === "negative")?.label).toMatch(/3 negative/);
    expect(brandHealth(readBrandProfile({ negativeWords: ["a", "b", "c"] }), 1).items.find((item) => item.id === "negative")?.ok).toBe(true);
  });

  it("packs profile extras into the existing SerpAPI query and does not add free-source searches", () => {
    const extras = profileSerpExtras(
      readBrandProfile({
        products: ["Genesis", "Jura"],
        hashtags: ["njd"],
        spokespeople: ["Ahmed Fathy"],
        competitors: ["Palm Hills"],
      }),
    );
    expect(extras).toContain("Genesis");
    const rule = ruleFromPhrase("New Jersey Developments", { synonyms: ["نيو جيرسي"] });
    const free = searchQueries(rule, FREE_SPLIT_QUERY_CAP);
    const packed = selectSerpSynonyms({ ...rule, synonyms: [...(rule.synonyms ?? []), ...extras] }, { rotateLeftovers: false });
    expect(searchQueries(rule, FREE_SPLIT_QUERY_CAP)).toEqual(free);
    expect(packed.query).toContain("Genesis");
    expect(queryWordCount(appendSerpExcludes(packed.query, ["Trenton"]))).toBeLessThanOrEqual(SERP_QUERY_WORD_LIMIT);
  });
});
