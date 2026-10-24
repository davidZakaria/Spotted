import { env } from "../config";
import { getJson } from "./http";
import type { Connector, InboxPayload, RawMention } from "./types";

function key() {
  return env("YOUTUBE_API_KEY");
}

export const youtubeConnector: Connector = {
  id: "YOUTUBE",
  name: "YouTube",
  family: "Google",
  docsUrl: "https://developers.google.com/youtube/v3",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(key()),
  async search(ctx) {
    if (!key()) return [];
    const data = await getJson<{
      items?: {
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          description?: string;
          publishedAt?: string;
          channelTitle?: string;
          channelId?: string;
        };
      }[];
    }>(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${ctx.limit ?? 15}&q=${encodeURIComponent(ctx.query)}&key=${key()}`,
    );
    const ids = (data.items ?? []).map((i) => i.id?.videoId).filter(Boolean).join(",");
    let stats: Record<string, { viewCount?: string; likeCount?: string; commentCount?: string }> = {};
    if (ids) {
      const s = await getJson<{ items?: { id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }>(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${key()}`,
      );
      for (const item of s.items ?? []) stats[item.id] = item.statistics ?? {};
    }
    return (data.items ?? []).flatMap((item) => {
      const id = item.id?.videoId;
      if (!id) return [];
      const st = stats[id] ?? {};
      return [{
        source: "YOUTUBE" as const,
        externalId: id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title: item.snippet?.title,
        content: item.snippet?.description ?? item.snippet?.title ?? "",
        authorName: item.snippet?.channelTitle,
        authorHandle: item.snippet?.channelId,
        authorUrl: item.snippet?.channelId
          ? `https://www.youtube.com/channel/${item.snippet.channelId}`
          : undefined,
        publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : new Date(),
        viewCount: Number(st.viewCount ?? 0),
        likeCount: Number(st.likeCount ?? 0),
        commentCount: Number(st.commentCount ?? 0),
        engagement: Number(st.likeCount ?? 0) + Number(st.commentCount ?? 0),
        reach: Number(st.viewCount ?? 0),
        kind: "video",
      }];
    });
  },
  async trackAccounts(ctx) {
    if (!key()) return [];
    const channels = ctx.projectConfig?.youtubeChannelIds ?? [];
    const out: RawMention[] = [];
    for (const channelId of channels.slice(0, 6)) {
      const data = await getJson<{ items?: { id?: { videoId?: string }; snippet?: { title?: string; description?: string; publishedAt?: string; channelTitle?: string } }[] }>(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&order=date&maxResults=8&type=video&key=${key()}`,
      );
      for (const item of data.items ?? []) {
        if (!item.id?.videoId) continue;
        out.push({
          source: "YOUTUBE",
          externalId: item.id.videoId,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          title: item.snippet?.title,
          content: item.snippet?.description ?? "",
          authorName: item.snippet?.channelTitle,
          publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : new Date(),
          kind: "video",
        });
      }
    }
    return out;
  },
  async fetchComments(ctx) {
    if (!key()) return [];
    const data = await getJson<{ items?: { id: string; snippet?: { topLevelComment?: { snippet?: { textDisplay?: string; authorDisplayName?: string; publishedAt?: string; likeCount?: number } } } }[] }>(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${ctx.externalId}&maxResults=20&key=${key()}`,
    );
    return (data.items ?? []).map((item) => {
      const s = item.snippet?.topLevelComment?.snippet;
      return {
        source: "YOUTUBE" as const,
        externalId: item.id,
        url: `https://www.youtube.com/watch?v=${ctx.externalId}&lc=${item.id}`,
        content: s?.textDisplay ?? "",
        authorName: s?.authorDisplayName,
        publishedAt: s?.publishedAt ? new Date(s.publishedAt) : new Date(),
        likeCount: s?.likeCount ?? 0,
        kind: "comment",
        parentExternalId: ctx.externalId,
      };
    });
  },
  async fetchInbox(ctx) {
    if (!ctx.accessToken) return [];
    const data = await getJson<{ items?: { id: string; snippet?: { topLevelComment?: { snippet?: { textDisplay?: string; authorDisplayName?: string; publishedAt?: string } } } }[] }>(
      "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&allThreadsRelatedToChannelId=true&mine=true&maxResults=20",
      { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
    );
    return (data.items ?? []).map((item) => ({
      externalId: item.id,
      type: "COMMENT" as const,
      authorName: item.snippet?.topLevelComment?.snippet?.authorDisplayName ?? "viewer",
      content: item.snippet?.topLevelComment?.snippet?.textDisplay ?? "",
      receivedAt: item.snippet?.topLevelComment?.snippet?.publishedAt
        ? new Date(item.snippet.topLevelComment.snippet.publishedAt)
        : new Date(),
    })) satisfies InboxPayload[];
  },
  async publish(input) {
    if (!input.accessToken) throw new Error("YouTube uploads require OAuth");
    throw new Error("YouTube upload uses resumable sessions — connect the channel and attach a video file in Publisher");
  },
  async ownAnalytics(ctx) {
    if (!ctx.accessToken) {
      return { followers: 0, impressions: 0, engagements: 0, period: "28d", series: [] };
    }
    const data = await getJson<{ rows?: [string, number, number][] }>(
      "https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&metrics=views,likes&dimensions=day&startDate=last28days&endDate=today",
      { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
    );
    const series = (data.rows ?? []).map((r) => ({
      date: r[0],
      impressions: r[1],
      engagements: r[2],
    }));
    return {
      followers: 0,
      impressions: series.reduce((a, b) => a + b.impressions, 0),
      engagements: series.reduce((a, b) => a + b.engagements, 0),
      period: "28d",
      series,
    };
  },
};
