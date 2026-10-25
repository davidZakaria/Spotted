import Parser from "rss-parser";
import type { Connector, ConnectorContext, RawMention, Source } from "./types";
import { parsePublishedAt } from "../listen/dates";

const parser = new Parser({
  timeout: 12000,
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["description", "description"],
      ["summary", "summary"],
    ],
  },
});

export type RssLikeItem = {
  title?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  description?: string;
  contentEncoded?: string;
  "content:encoded"?: string;
  guid?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  creator?: string;
};

export function stripFeedHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function rssItemSearchText(item: RssLikeItem) {
  const parts = [
    item.title,
    item.contentSnippet,
    item.content,
    item.summary,
    item.description,
    item.contentEncoded,
    item["content:encoded"],
  ];
  const unique: string[] = [];
  for (const part of parts) {
    const cleaned = stripFeedHtml(String(part ?? ""));
    if (cleaned && !unique.includes(cleaned)) unique.push(cleaned);
  }
  return unique.join("\n");
}

export function mentionFromRssItem(
  source: Source,
  item: RssLikeItem,
  extras: { feedTitle?: string; feedUrl: string },
): RawMention {
  const searchText = rssItemSearchText(item);
  const title = item.title ? stripFeedHtml(item.title) : undefined;
  const body = searchText
    .split("\n")
    .filter((part) => part && part !== title)
    .join("\n");
  return {
    source,
    externalId: item.guid || item.link || `${extras.feedUrl}:${item.isoDate}:${item.title}`,
    url: item.link || extras.feedUrl,
    title,
    content: body || title || "",
    authorName: item.creator || extras.feedTitle,
    publishedAt: parsePublishedAt(item.isoDate ?? item.pubDate),
    kind: "article",
    raw: { feed: extras.feedTitle, url: extras.feedUrl, description: item.description ?? null },
  };
}

export async function parseFeeds(
  source: Source,
  urls: string[],
  query?: string,
  maxItems = 30,
): Promise<RawMention[]> {
  const out: RawMention[] = [];
  for (const url of urls.slice(0, 16)) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, maxItems)) {
        const mention = mentionFromRssItem(source, item as RssLikeItem, {
          feedTitle: feed.title,
          feedUrl: url,
        });
        if (query && source === "RSS") {
          // dedicated feeds still include items; keyword matching happens at ingest
        }
        out.push(mention);
      }
    } catch {
      // skip broken feeds
    }
  }
  return out;
}

export const DEFAULT_RSS_FEEDS = [
  "https://news.ycombinator.com/rss",
  "https://www.theverge.com/rss/index.xml",
  "https://techcrunch.com/feed/",
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://feeds.reuters.com/reuters/topNews",
  "https://www.theguardian.com/world/rss",
  "https://www.aljazeera.com/xml/rss/all.xml",
  "https://www.wired.com/feed/rss",
  "https://feeds.arstechnica.com/arstechnica/index",
  "https://www.npr.org/rss/rss.php?id=1001",
];

export const rssConnector: Connector = {
  id: "RSS",
  name: "News / RSS",
  family: "RSS",
  docsUrl: "https://www.rssboard.org/rss-specification",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx: ConnectorContext) {
    const feeds = ctx.projectConfig?.rssFeeds?.length ? ctx.projectConfig.rssFeeds : DEFAULT_RSS_FEEDS;
    const items = await parseFeeds("RSS", feeds, ctx.query);
    return items.filter((m) =>
      !ctx.query ? true : `${m.title ?? ""} ${m.content}`.toLowerCase().includes(ctx.query.toLowerCase()),
    );
  },
};
