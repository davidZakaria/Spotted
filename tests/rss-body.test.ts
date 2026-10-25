import { describe, expect, it } from "vitest";
import { mentionFromRssItem, rssItemSearchText } from "@/lib/connectors/rss";
import { mentionMatches, mentionSearchText, ruleFromPhrase } from "@/lib/listen/query";

describe("Google News RSS description matching", () => {
  it("keeps Arabic News items whose keyword is only in the description body", () => {
    const item = {
      title: "تحقيق جديد في الساحل الشمالي",
      description:
        "متضررو نيو جيرسي يروون قصة نصب وفشل وبجاحة بعد فسخ العقد وتأخير التسليم إلى 2030 في مشروع Genesis",
      contentSnippet: "",
      link: "https://www.masrtimes.com/744526",
      guid: "masrtimes-744526",
      isoDate: "2026-03-01T00:00:00.000Z",
    };
    expect(rssItemSearchText(item)).toMatch(/نيو جيرسي/);
    expect(rssItemSearchText(item)).toMatch(/Genesis/);

    const mention = mentionFromRssItem("GOOGLE_NEWS", item, {
      feedTitle: "Google News",
      feedUrl: "https://news.google.com/rss/search?q=نيو%20جيرسي&hl=ar&gl=EG&ceid=EG:ar",
    });
    expect(mention.title).not.toMatch(/نيو جيرسي|Genesis/);
    expect(mention.content).toMatch(/نيو جيرسي/);
    expect(mention.content).toMatch(/Genesis/);

    const search = mentionSearchText(mention);
    expect(mentionMatches(search, ruleFromPhrase("نيو جيرسي"))).toBe(true);
    expect(mentionMatches(search, ruleFromPhrase("Genesis"))).toBe(true);
    expect(mentionMatches(mention.title ?? "", ruleFromPhrase("نيو جيرسي"))).toBe(false);
  });

  it("matches a title-less delay story on the description", () => {
    const mention = mentionFromRssItem(
      "GOOGLE_NEWS",
      {
        title: "موعد جديد للوحدات",
        description: "<p>Genesis delivery delayed to 2030 after buyers filed a lawsuit</p>",
        link: "https://www.tafsela.net/88944",
        guid: "tafsela-88944",
      },
      { feedTitle: "Google News", feedUrl: "https://news.google.com/rss/search?q=Genesis&hl=ar&gl=EG&ceid=EG:ar" },
    );
    expect(mentionMatches(mentionSearchText(mention), ruleFromPhrase("Genesis"))).toBe(true);
    expect(mention.content).toMatch(/delivery delayed to 2030/i);
  });
});
