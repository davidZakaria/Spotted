import { getJson } from "./http";
import type { Connector, RawMention } from "./types";

type HnHit = {
  objectID: string;
  title?: string;
  story_title?: string;
  story_text?: string;
  comment_text?: string;
  url?: string;
  author?: string;
  created_at?: string;
  points?: number;
  num_comments?: number;
  story_id?: number;
};

export const hnConnector: Connector = {
  id: "HACKER_NEWS",
  name: "Hacker News",
  family: "News",
  docsUrl: "https://hn.algolia.com/api",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    const q = encodeURIComponent(ctx.query);
    const since = ctx.since ? Math.floor(ctx.since.getTime() / 1000) : 0;
    const out: RawMention[] = [];
    const pages = ctx.purpose === "backfill" ? 4 : 2;
    for (let page = 0; page < pages; page += 1) {
      const data = await getJson<{ hits?: HnHit[] }>(
        `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=(story,comment)&hitsPerPage=${ctx.limit ?? 25}&page=${page}${since ? `&numericFilters=created_at_i>${since}` : ""}`,
      );
      out.push(
        ...(data.hits ?? []).map((h) => ({
      source: "HACKER_NEWS" as const,
      externalId: h.objectID,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      title: h.title || h.story_title,
      content: h.story_text || h.comment_text || h.title || "",
      authorName: h.author,
      authorHandle: h.author,
      authorUrl: h.author ? `https://news.ycombinator.com/user?id=${h.author}` : undefined,
      publishedAt: h.created_at ? new Date(h.created_at) : new Date(),
      likeCount: h.points ?? 0,
      commentCount: h.num_comments ?? 0,
      engagement: (h.points ?? 0) + (h.num_comments ?? 0),
      reach: h.points ?? 0,
      kind: h.comment_text ? "comment" : "post",
      parentExternalId: h.story_id ? String(h.story_id) : undefined,
      raw: h,
    })),
      );
      if ((data.hits?.length ?? 0) < 10) break;
    }
    return out;
  },
  async trackAccounts(ctx) {
    const authors = ctx.projectConfig?.competitors ?? [];
    const out: RawMention[] = [];
    for (const author of authors.slice(0, 5)) {
      const data = await getJson<{ hits?: HnHit[] }>(
        `https://hn.algolia.com/api/v1/search_by_date?tags=author_${encodeURIComponent(author)}&hitsPerPage=10`,
      );
      out.push(...(await this.search({ ...ctx, query: author })).slice(0, 0));
      for (const h of data.hits ?? []) {
        out.push({
          source: "HACKER_NEWS",
          externalId: h.objectID,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          title: h.title || h.story_title,
          content: h.story_text || h.comment_text || h.title || "",
          authorName: h.author,
          publishedAt: h.created_at ? new Date(h.created_at) : new Date(),
          likeCount: h.points ?? 0,
          kind: "post",
        });
      }
    }
    return out;
  },
};
