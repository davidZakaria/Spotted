import { env } from "../config";
import { getJson } from "./http";
import { cap, type Connector, type RawMention } from "./types";

type RedditListing = {
  data?: {
    children?: {
      data: {
        id: string;
        name?: string;
        title?: string;
        selftext?: string;
        body?: string;
        permalink: string;
        author: string;
        created_utc: number;
        score?: number;
        ups?: number;
        num_comments?: number;
        subreddit?: string;
        url?: string;
      };
    }[];
  };
};

function mapChild(child: NonNullable<RedditListing["data"]>["children"] extends (infer T)[] | undefined ? T : never, kind: string): RawMention {
  const d = child.data;
  return {
    source: "REDDIT",
    externalId: d.name ?? d.id,
    url: d.permalink?.startsWith("http") ? d.permalink : `https://www.reddit.com${d.permalink}`,
    title: d.title,
    content: d.selftext || d.body || d.title || "",
    authorName: d.author,
    authorHandle: d.author,
    authorUrl: `https://www.reddit.com/user/${d.author}`,
    publishedAt: new Date((d.created_utc || 0) * 1000),
    likeCount: d.ups ?? d.score ?? 0,
    commentCount: d.num_comments ?? 0,
    engagement: (d.score ?? 0) + (d.num_comments ?? 0),
    reach: d.score ?? 0,
    kind,
    raw: d,
  };
}

async function redditGet(path: string) {
  const id = env("REDDIT_CLIENT_ID");
  const secret = env("REDDIT_CLIENT_SECRET");
  let headers: Record<string, string> = {};
  let host = "https://www.reddit.com";
  if (id && secret) {
    const basic = Buffer.from(`${id}:${secret}`).toString("base64");
    const token = await getJson<{ access_token: string }>("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    headers = { Authorization: `Bearer ${token.access_token}` };
    host = "https://oauth.reddit.com";
  }
  return getJson<RedditListing>(`${host}${path}`, { headers });
}

export const redditConnector: Connector = {
  id: "REDDIT",
  name: "Reddit",
  family: "Reddit",
  docsUrl: "https://www.reddit.com/dev/api",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    const q = encodeURIComponent(ctx.query);
    const data = await redditGet(`/search.json?q=${q}&sort=new&limit=${ctx.limit ?? 25}&t=week`);
    return (data.data?.children ?? []).map((c) => mapChild(c, "post"));
  },
  async trackAccounts(ctx) {
    const subs = ctx.projectConfig?.redditSubreddits ?? [];
    const out: RawMention[] = [];
    for (const sub of subs.slice(0, 8)) {
      const data = await redditGet(`/r/${encodeURIComponent(sub.replace(/^r\//, ""))}/new.json?limit=15`);
      out.push(...(data.data?.children ?? []).map((c) => mapChild(c, "post")));
    }
    return out;
  },
  async fetchComments(ctx) {
    const id = ctx.externalId.replace(/^t3_/, "");
    const data = await getJson<unknown>(`https://www.reddit.com/comments/${id}.json?limit=20`);
    const listing = Array.isArray(data) ? (data[1] as RedditListing) : undefined;
    return (listing?.data?.children ?? [])
      .filter((c) => c.data?.body)
      .map((c) => ({ ...mapChild(c, "comment"), parentExternalId: ctx.externalId }));
  },
  async fetchInbox(ctx) {
    if (!ctx.accessToken) return [];
    const data = await getJson<RedditListing>("https://oauth.reddit.com/message/inbox?limit=25", {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    });
    return (data.data?.children ?? []).map((c) => ({
      externalId: c.data.id,
      type: c.data.body?.startsWith("comment") ? "COMMENT" : "MESSAGE",
      authorName: c.data.author,
      content: c.data.body || c.data.title || "",
      url: `https://www.reddit.com${c.data.permalink}`,
      receivedAt: new Date((c.data.created_utc || 0) * 1000),
    }));
  },
  async publish(input) {
    if (!input.accessToken) throw new Error("Reddit publishing requires a connected OAuth account");
    const body = new URLSearchParams({
      sr: "testingground4bots",
      kind: "self",
      title: input.content.slice(0, 80),
      text: input.content,
    });
    const res = await getJson<{ json?: { data?: { id?: string; url?: string } } }>(
      "https://oauth.reddit.com/api/submit",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    return { externalId: res.json?.data?.id ?? "reddit-post", url: res.json?.data?.url };
  },
  async reply(ctx) {
    if (!ctx.accessToken) throw new Error("Reddit reply requires OAuth");
    await getJson("https://oauth.reddit.com/api/comment", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ thing_id: ctx.externalId, text: ctx.message }).toString(),
    });
  },
  async ownAnalytics() {
    return { followers: 0, impressions: 0, engagements: 0, period: "7d", series: [] };
  },
};

void cap;
