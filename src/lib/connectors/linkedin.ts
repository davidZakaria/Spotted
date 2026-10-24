import { env } from "../config";
import { getJson, postJson } from "./http";
import type { Connector, InboxPayload } from "./types";

export const linkedinConnector: Connector = {
  id: "LINKEDIN",
  name: "LinkedIn",
  family: "LinkedIn",
  docsUrl: "https://learn.microsoft.com/en-us/linkedin/",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("LINKEDIN_CLIENT_ID")),
  async search() {
    // LinkedIn does not permit public keyword listening.
    return [];
  },
  async fetchInbox(ctx) {
    if (!ctx.accessToken || !ctx.accountExternalId) return [];
    const data = await getJson<{ elements?: { id: string; commentary?: string; createdAt?: number }[] }>(
      `https://api.linkedin.com/rest/posts?author=urn:li:organization:${ctx.accountExternalId}&q=author`,
      {
        headers: {
          Authorization: `Bearer ${ctx.accessToken}`,
          "LinkedIn-Version": "202401",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      },
    );
    return (data.elements ?? []).map((p) => ({
      externalId: p.id,
      type: "COMMENT" as const,
      authorName: "LinkedIn member",
      content: p.commentary ?? "",
      receivedAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    })) satisfies InboxPayload[];
  },
  async publish(input) {
    if (!input.accessToken || !input.accountExternalId) throw new Error("LinkedIn publishing requires a Company Page OAuth token");
    const res = await postJson<{ id?: string }>(
      "https://api.linkedin.com/rest/posts",
      {
        author: `urn:li:organization:${input.accountExternalId}`,
        commentary: input.content,
        visibility: "PUBLIC",
        lifecycleState: "PUBLISHED",
        distribution: { feedDistribution: "MAIN_FEED" },
      },
      {
        Authorization: `Bearer ${input.accessToken}`,
        "LinkedIn-Version": "202401",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    );
    return { externalId: res.id ?? "linkedin-post" };
  },
  async reply(ctx) {
    if (!ctx.accessToken) throw new Error("LinkedIn reply requires OAuth");
    await postJson(
      "https://api.linkedin.com/rest/socialActions/" + encodeURIComponent(ctx.externalId) + "/comments",
      { actor: `urn:li:organization:${ctx.accountExternalId}`, message: { text: ctx.message } },
      { Authorization: `Bearer ${ctx.accessToken}`, "LinkedIn-Version": "202401" },
    );
  },
  async ownAnalytics(ctx) {
    if (!ctx.accessToken || !ctx.accountExternalId) {
      return { followers: 0, impressions: 0, engagements: 0, period: "30d", series: [] };
    }
    const data = await getJson<{ followerGains?: { organicFollowerGain?: number } }>(
      `https://api.linkedin.com/rest/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${ctx.accountExternalId}`,
      { headers: { Authorization: `Bearer ${ctx.accessToken}`, "LinkedIn-Version": "202401" } },
    );
    return {
      followers: data.followerGains?.organicFollowerGain ?? 0,
      impressions: 0,
      engagements: 0,
      period: "30d",
      series: [],
    };
  },
};
