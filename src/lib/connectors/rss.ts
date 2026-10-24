import Parser from "rss-parser";
import type { Connector, ConnectorContext, RawMention, Source } from "./types";

const parser = new Parser({ timeout: 12000 });

export async function parseFeeds(
  source: Source,
  urls: string[],
  query?: string,
): Promise<RawMention[]> {
  const out: RawMention[] = [];
  for (const url of urls.slice(0, 12)) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items.slice(0, 20)) {
        const content = [item.title, item.contentSnippet, item.content].filter(Boolean).join("\n");
        if (query && !content.toLowerCase().includes(query.toLowerCase()) && source === "RSS") {
          // still include RSS items from a dedicated feed
        }
        out.push({
          source,
          externalId: item.guid || item.link || `${url}:${item.isoDate}:${item.title}`,
          url: item.link || url,
          title: item.title,
          content: item.contentSnippet || item.content || item.title || "",
          authorName: item.creator || feed.title,
          publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
          kind: "article",
          raw: { feed: feed.title, url },
        });
      }
    } catch {
      // skip broken feeds
    }
  }
  return out;
}

export const rssConnector: Connector = {
  id: "RSS",
  name: "News / RSS",
  family: "RSS",
  docsUrl: "https://www.rssboard.org/rss-specification",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx: ConnectorContext) {
    const feeds = ctx.projectConfig?.rssFeeds?.length
      ? ctx.projectConfig.rssFeeds
      : [
          "https://news.ycombinator.com/rss",
          "https://www.theverge.com/rss/index.xml",
        ];
    const items = await parseFeeds("RSS", feeds, ctx.query);
    return items.filter((m) =>
      !ctx.query
        ? true
        : `${m.title} ${m.content}`.toLowerCase().includes(ctx.query.toLowerCase()),
    );
  },
};
