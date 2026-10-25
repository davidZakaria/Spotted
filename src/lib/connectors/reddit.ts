import { env } from "../config";
import { getJson, HttpError } from "./http";
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

export function redditUserAgent(e: Record<string, string | undefined> = process.env) {
  return e.REDDIT_USER_AGENT?.trim() || "web:spotted-listener:1.0.0 (by /u/spotted_app)";
}

export function redditPublicBases() {
  return ["https://old.reddit.com", "https://www.reddit.com"] as const;
}

export function redditOauthPath(path: string) {
  return path.replace(/\.json(?=\?|$)/, "");
}

function retryable(error: unknown) {
  return error instanceof HttpError && (error.status === 401 || error.status === 403 || error.status === 429);
}

async function redditAppToken() {
  const id = env("REDDIT_CLIENT_ID");
  const secret = env("REDDIT_CLIENT_SECRET");
  if (!id || !secret) return null;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const token = await getJson<{ access_token?: string }>("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": redditUserAgent(),
    },
    body: "grant_type=client_credentials",
  });
  return token.access_token ?? null;
}

async function redditGet<T = RedditListing>(path: string): Promise<T> {
  const ua = redditUserAgent();
  const errors: HttpError[] = [];

  try {
    const accessToken = await redditAppToken();
    if (accessToken) {
      try {
        return await getJson<T>(`https://oauth.reddit.com${redditOauthPath(path)}`, {
          headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": ua },
        });
      } catch (error) {
        if (!retryable(error)) throw error;
        if (error instanceof HttpError) errors.push(error);
      }
    }
  } catch (error) {
    if (!retryable(error)) throw error;
    if (error instanceof HttpError) errors.push(error);
  }

  for (const host of redditPublicBases()) {
    try {
      return await getJson<T>(`${host}${path}`, { headers: { "User-Agent": ua } });
    } catch (error) {
      if (!retryable(error)) throw error;
      if (error instanceof HttpError) errors.push(error);
    }
  }

  throw new HttpError(
    "Reddit blocked this server. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (create a script app at reddit.com/prefs/apps) and set REDDIT_USER_AGENT to web:spotted:1.0.0 (by /u/your_username).",
    403,
    errors[0]?.body,
  );
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
    const window = ctx.since && Date.now() - ctx.since.getTime() > 8 * 86400000 ? "month" : "week";
    const out: RawMention[] = [];
    let after = "";
    for (let page = 0; page < 2; page += 1) {
      const data = await redditGet(`/search.json?q=${q}&sort=new&limit=${ctx.limit ?? 25}&t=${window}${after ? `&after=${after}` : ""}`);
      out.push(...(data.data?.children ?? []).map((c) => mapChild(c, "post")));
      after = (data.data as { after?: string } | undefined)?.after ?? "";
      if (!after) break;
    }
    return out;
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
    const data = await redditGet<unknown>(`/comments/${id}.json?limit=20`);
    const listing = Array.isArray(data) ? (data[1] as RedditListing) : (data as RedditListing | undefined);
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
