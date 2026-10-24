import { env } from "../config";
import { getJson, postJson } from "./http";
import { assertBudget, recordUsage, warnProject } from "./usage";
import type { Connector, InboxPayload, RawMention } from "./types";

function bearer(token?: string) {
  return token || env("TWITTER_BEARER_TOKEN");
}

type Tweet = {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number; impression_count?: number };
  author_id?: string;
};

type User = { id: string; name?: string; username?: string; public_metrics?: { followers_count?: number } };

async function xGet<T>(path: string, ctx: { workspaceId?: string; projectId?: string; accessToken?: string }, endpoint: string) {
  const token = bearer(ctx.accessToken);
  if (!token) return null;
  const budget = await assertBudget(ctx.workspaceId, "X");
  if (!budget.allowed) {
    await warnProject(ctx.projectId, "X", "budget", budget.reason ?? "X budget reached");
    return null;
  }
  const data = await getJson<T>(`https://api.x.com/2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await recordUsage({ workspaceId: ctx.workspaceId, source: "X", endpoint, costPerCallUsd: 0.005 });
  return data;
}

function mapTweet(t: Tweet, users: Record<string, User>): RawMention {
  const u = t.author_id ? users[t.author_id] : undefined;
  return {
    source: "X",
    externalId: t.id,
    url: u ? `https://x.com/${u.username}/status/${t.id}` : `https://x.com/i/web/status/${t.id}`,
    content: t.text,
    authorName: u?.name,
    authorHandle: u?.username,
    authorUrl: u ? `https://x.com/${u.username}` : undefined,
    publishedAt: t.created_at ? new Date(t.created_at) : new Date(),
    likeCount: t.public_metrics?.like_count ?? 0,
    shareCount: t.public_metrics?.retweet_count ?? 0,
    commentCount: t.public_metrics?.reply_count ?? 0,
    viewCount: t.public_metrics?.impression_count ?? 0,
    followerCount: u?.public_metrics?.followers_count ?? 0,
    engagement:
      (t.public_metrics?.like_count ?? 0) +
      (t.public_metrics?.retweet_count ?? 0) +
      (t.public_metrics?.reply_count ?? 0),
    reach: t.public_metrics?.impression_count ?? u?.public_metrics?.followers_count ?? 0,
    kind: "post",
    raw: t,
  };
}

export const xConnector: Connector = {
  id: "X",
  name: "X (Twitter)",
  family: "X",
  docsUrl: "https://docs.x.com/x-api/introduction",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("TWITTER_BEARER_TOKEN") || env("TWITTER_CLIENT_ID")),
  async search(ctx) {
    const data = await xGet<{ data?: Tweet[]; includes?: { users?: User[] } }>(
      `/tweets/search/recent?query=${encodeURIComponent(ctx.query)}&max_results=20&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username,name,public_metrics`,
      ctx,
      "search.recent",
    );
    if (!data?.data) return [];
    const users = Object.fromEntries((data.includes?.users ?? []).map((u) => [u.id, u]));
    return data.data.map((t) => mapTweet(t, users));
  },
  async trackAccounts(ctx) {
    const handles = ctx.projectConfig?.competitors ?? [];
    const out: RawMention[] = [];
    for (const handle of handles.slice(0, 5)) {
      const user = await xGet<{ data?: User }>(`/users/by/username/${encodeURIComponent(handle.replace("@", ""))}`, ctx, "users.by");
      const id = user?.data?.id;
      if (!id) continue;
      const timeline = await xGet<{ data?: Tweet[]; includes?: { users?: User[] } }>(
        `/users/${id}/tweets?max_results=10&tweet.fields=created_at,public_metrics,author_id&expansions=author_id`,
        ctx,
        "users.tweets",
      );
      const users = Object.fromEntries((timeline?.includes?.users ?? []).map((u) => [u.id, u]));
      out.push(...(timeline?.data ?? []).map((t) => mapTweet(t, users)));
    }
    return out;
  },
  async fetchInbox(ctx) {
    if (!ctx.accessToken || !ctx.accountExternalId) return [];
    const mentions = await xGet<{ data?: Tweet[] }>(
      `/users/${ctx.accountExternalId}/mentions?max_results=20&tweet.fields=created_at,author_id`,
      ctx,
      "mentions",
    );
    const dms = await xGet<{ data?: { id: string; text?: string; created_at?: string }[] }>(
      `/dm_events?max_results=20`,
      ctx,
      "dm_events",
    );
    const items: InboxPayload[] = [];
    for (const t of mentions?.data ?? []) {
      items.push({
        externalId: t.id,
        type: "MENTION",
        authorName: t.author_id ?? "user",
        content: t.text,
        receivedAt: t.created_at ? new Date(t.created_at) : new Date(),
        url: `https://x.com/i/web/status/${t.id}`,
      });
    }
    for (const d of dms?.data ?? []) {
      items.push({
        externalId: d.id,
        type: "MESSAGE",
        authorName: "X user",
        content: d.text ?? "",
        receivedAt: d.created_at ? new Date(d.created_at) : new Date(),
      });
    }
    return items;
  },
  async publish(input) {
    if (!input.accessToken) throw new Error("X publishing requires user OAuth");
    const res = await postJson<{ data?: { id: string } }>(
      "https://api.x.com/2/tweets",
      { text: input.content },
      { Authorization: `Bearer ${input.accessToken}` },
    );
    return { externalId: res.data?.id ?? "x-post", url: res.data?.id ? `https://x.com/i/web/status/${res.data.id}` : undefined };
  },
  async reply(ctx) {
    if (!ctx.accessToken) throw new Error("X reply requires OAuth");
    await postJson(
      "https://api.x.com/2/tweets",
      { text: ctx.message, reply: { in_reply_to_tweet_id: ctx.externalId } },
      { Authorization: `Bearer ${ctx.accessToken}` },
    );
  },
  async ownAnalytics(ctx) {
    if (!ctx.accountExternalId) {
      return { followers: 0, impressions: 0, engagements: 0, period: "7d", series: [] };
    }
    const user = await xGet<{ data?: User }>(`/users/${ctx.accountExternalId}?user.fields=public_metrics`, ctx, "users.me");
    return {
      followers: user?.data?.public_metrics?.followers_count ?? 0,
      impressions: 0,
      engagements: 0,
      period: "7d",
      series: [],
    };
  },
};
