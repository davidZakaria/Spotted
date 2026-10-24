import { env } from "../config";
import { getJson, postJson } from "./http";
import type { Connector, InboxPayload } from "./types";

export const tiktokConnector: Connector = {
  id: "TIKTOK",
  name: "TikTok",
  family: "TikTok",
  docsUrl: "https://developers.tiktok.com/",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("TIKTOK_CLIENT_KEY")),
  async search() {
    // Commercial apps cannot search competitor or public keyword firehoses.
    return [];
  },
  async fetchInbox(ctx) {
    if (!ctx.accessToken) return [];
    const videos = await getJson<{ data?: { videos?: { id: string; title?: string; create_time?: number }[] } }>(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,like_count,comment_count",
      { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
    );
    const items: InboxPayload[] = [];
    for (const v of videos.data?.videos ?? []) {
      items.push({
        externalId: v.id,
        type: "COMMENT",
        authorName: "TikTok viewer",
        content: v.title ?? "Video comments available on owned account",
        receivedAt: v.create_time ? new Date(v.create_time * 1000) : new Date(),
      });
    }
    return items;
  },
  async publish(input) {
    if (!input.accessToken) throw new Error("TikTok publishing requires OAuth");
    const res = await postJson<{ data?: { publish_id?: string } }>(
      "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
      { post_info: { title: input.content.slice(0, 150), privacy_level: "PUBLIC_TO_EVERYONE" } },
      { Authorization: `Bearer ${input.accessToken}` },
    );
    return { externalId: res.data?.publish_id ?? "tiktok-post" };
  },
  async ownAnalytics(ctx) {
    if (!ctx.accessToken) return { followers: 0, impressions: 0, engagements: 0, period: "7d", series: [] };
    const data = await getJson<{ data?: { metrics?: { video_views?: number; likes?: number } } }>(
      "https://open.tiktokapis.com/v2/user/insights/?fields=video_views,likes",
      { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
    );
    return {
      followers: 0,
      impressions: data.data?.metrics?.video_views ?? 0,
      engagements: data.data?.metrics?.likes ?? 0,
      period: "7d",
      series: [],
    };
  },
};
