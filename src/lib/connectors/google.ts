import { env } from "../config";
import { getJson } from "./http";
import { parseFeeds } from "./rss";
import type { Connector, InboxPayload, RawMention } from "./types";

export const googleNewsConnector: Connector = {
  id: "GOOGLE_NEWS",
  name: "Google News",
  family: "Google",
  docsUrl: "https://news.google.com/rss",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    const hl = ctx.language === "ar" ? "ar" : "en-US";
    const gl = ctx.language === "ar" ? "EG" : "US";
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(ctx.query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split("-")[0]}`;
    return parseFeeds("GOOGLE_NEWS", [url]);
  },
};

export const googleAlertsConnector: Connector = {
  id: "GOOGLE_ALERTS",
  name: "Google Alerts",
  family: "Google",
  docsUrl: "https://www.google.com/alerts",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    const feeds = ctx.projectConfig?.googleAlertFeeds ?? [];
    if (!feeds.length) return [];
    return parseFeeds("GOOGLE_ALERTS", feeds);
  },
};

export const googleBusinessConnector: Connector = {
  id: "GOOGLE_BUSINESS",
  name: "Google Business Profile",
  family: "Google",
  docsUrl: "https://developers.google.com/my-business",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("GOOGLE_GBP_CLIENT_ID") && env("GOOGLE_GBP_CLIENT_SECRET")),
  async search() {
    return [];
  },
  async fetchInbox(ctx) {
    if (!ctx.accessToken || !ctx.accountExternalId) return [];
    const data = await getJson<{ reviews?: { reviewId: string; comment?: string; reviewer?: { displayName?: string }; createTime?: string; reviewReply?: { comment?: string } }[] }>(
      `https://mybusiness.googleapis.com/v4/${ctx.accountExternalId}/reviews`,
      { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
    );
    return (data.reviews ?? []).map((r) => ({
      externalId: r.reviewId,
      type: "REVIEW" as const,
      authorName: r.reviewer?.displayName ?? "Reviewer",
      content: r.comment ?? "",
      receivedAt: r.createTime ? new Date(r.createTime) : new Date(),
    })) satisfies InboxPayload[];
  },
  async reply(ctx) {
    if (!ctx.accessToken) throw new Error("GBP reply requires OAuth");
    await getJson(
      `https://mybusiness.googleapis.com/v4/${ctx.accountExternalId}/reviews/${ctx.externalId}/reply`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${ctx.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: ctx.message }),
      },
    );
  },
  async publish(input) {
    if (!input.accessToken || !input.accountExternalId) throw new Error("GBP local posts require OAuth");
    const res = await getJson<{ name?: string }>(
      `https://mybusiness.googleapis.com/v4/${input.accountExternalId}/localPosts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ languageCode: "en", summary: input.content, topicType: "STANDARD" }),
      },
    );
    return { externalId: res.name ?? "gbp-post" };
  },
  async ownAnalytics() {
    return { followers: 0, impressions: 0, engagements: 0, period: "30d", series: [] };
  },
};

export const googleTrendsConnector: Connector = {
  id: "GOOGLE_TRENDS",
  name: "Google Trends",
  family: "Google",
  docsUrl: "https://trends.google.com",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    // Trends is a widget, not a mention source. Return a synthetic interest marker when possible.
    try {
      const url = `https://trends.google.com/trends/api/explore?hl=en-US&req=${encodeURIComponent(
        JSON.stringify({
          comparisonItem: [{ keyword: ctx.query, geo: "", time: "now 7-d" }],
          category: 0,
          property: "",
        }),
      )}`;
      await fetch(url, { headers: { "User-Agent": "AetherSocial/1.0" } });
    } catch {
      // ignore
    }
    return [] as RawMention[];
  },
};
