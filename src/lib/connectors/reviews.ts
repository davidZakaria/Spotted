import { env } from "../config";
import { getJson } from "./http";
import { parseFeeds } from "./rss";
import type { Connector, InboxPayload, RawMention } from "./types";

export const podcastsConnector: Connector = {
  id: "PODCASTS",
  name: "Podcasts",
  family: "Audio",
  docsUrl: "https://podcastindex-org.github.io/docs-api",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    const key = env("PODCAST_INDEX_API_KEY");
    const secret = env("PODCAST_INDEX_API_SECRET");
    if (key && secret) {
      const now = Math.floor(Date.now() / 1000).toString();
      const crypto = await import("node:crypto");
      const auth = crypto.createHash("sha1").update(key + secret + now).digest("hex");
      const data = await getJson<{ feeds?: { id: number; title?: string; description?: string; url?: string; author?: string; newestItemPubdate?: number }[] }>(
        `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(ctx.query)}`,
      { headers: { "X-Auth-Date": now, "X-Auth-Key": key, Authorization: auth, "User-Agent": "SpottedSocial/1.0" } },
      );
      return (data.feeds ?? []).map((f) => ({
        source: "PODCASTS" as const,
        externalId: String(f.id),
        url: f.url ?? "",
        title: f.title,
        content: f.description ?? "",
        authorName: f.author,
        publishedAt: f.newestItemPubdate ? new Date(f.newestItemPubdate * 1000) : new Date(),
        kind: "podcast",
      }));
    }
    const data = await getJson<{ results?: { trackId: number; trackName?: string; artistName?: string; feedUrl?: string; releaseDate?: string; description?: string }[] }>(
      `https://itunes.apple.com/search?term=${encodeURIComponent(ctx.query)}&media=podcast&limit=15`,
    );
    return (data.results ?? []).map((r) => ({
      source: "PODCASTS" as const,
      externalId: String(r.trackId),
      url: r.feedUrl ?? `https://podcasts.apple.com/lookup?id=${r.trackId}`,
      title: r.trackName,
      content: r.description ?? r.trackName ?? "",
      authorName: r.artistName,
      publishedAt: r.releaseDate ? new Date(r.releaseDate) : new Date(),
      kind: "podcast",
    }));
  },
};

export const trustpilotConnector: Connector = {
  id: "TRUSTPILOT",
  name: "Trustpilot",
  family: "Reviews",
  docsUrl: "https://developers.trustpilot.com/",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("TRUSTPILOT_API_KEY")),
  async search(ctx) {
    const key = env("TRUSTPILOT_API_KEY");
    if (!key) return [];
    const data = await getJson<{ reviews?: { id: string; text?: string; title?: string; createdAt?: string; consumer?: { displayName?: string }; stars?: number }[] }>(
      `https://api.trustpilot.com/v1/business-units/${encodeURIComponent(ctx.query)}/reviews`,
      { headers: { apikey: key } },
    );
    return (data.reviews ?? []).map((r) => ({
      source: "TRUSTPILOT" as const,
      externalId: r.id,
      url: `https://www.trustpilot.com/reviews/${r.id}`,
      title: r.title,
      content: r.text ?? "",
      authorName: r.consumer?.displayName,
      publishedAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      likeCount: r.stars ?? 0,
      kind: "review",
    }));
  },
  async fetchInbox(ctx) {
    const items = await this.search(ctx);
    return items.map((m) => ({
      externalId: m.externalId,
      type: "REVIEW" as const,
      authorName: m.authorName ?? "Reviewer",
      content: m.content,
      receivedAt: m.publishedAt,
      url: m.url,
    })) satisfies InboxPayload[];
  },
};

export const g2Connector: Connector = {
  id: "G2",
  name: "G2",
  family: "Reviews",
  docsUrl: "https://data.g2.com/",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("G2_API_TOKEN")),
  async search(ctx) {
    const token = env("G2_API_TOKEN");
    if (!token) return [];
    const data = await getJson<{ data?: { id: string; attributes?: { title?: string; comment?: string; "submitted-at"?: string } }[] }>(
      `https://data.g2.com/api/v1/products/${encodeURIComponent(ctx.query)}/reviews`,
      { headers: { Authorization: `Token token=${token}` } },
    );
    return (data.data ?? []).map((r) => ({
      source: "G2" as const,
      externalId: r.id,
      url: `https://www.g2.com/reviews/${r.id}`,
      title: r.attributes?.title,
      content: r.attributes?.comment ?? "",
      publishedAt: r.attributes?.["submitted-at"] ? new Date(r.attributes["submitted-at"]) : new Date(),
      kind: "review",
    }));
  },
};

export const appStoreConnector: Connector = {
  id: "APP_STORE",
  name: "Apple App Store",
  family: "Reviews",
  docsUrl: "https://developer.apple.com/app-store-connect/",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    const ids = ctx.projectConfig?.appStoreIds ?? [];
    const out: RawMention[] = [];
    for (const id of ids.slice(0, 6)) {
      const items = await parseFeeds("APP_STORE", [
        `https://itunes.apple.com/us/rss/customerreviews/id=${encodeURIComponent(id)}/sortBy=mostRecent/xml`,
      ]);
      out.push(
        ...items.map((m) => ({
          ...m,
          source: "APP_STORE" as const,
          kind: "review",
        })),
      );
    }
    return out;
  },
};

export const playStoreConnector: Connector = {
  id: "PLAY_STORE",
  name: "Google Play",
  family: "Reviews",
  docsUrl: "https://developers.google.com/android-publisher",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("GOOGLE_PLAY_JSON")),
  async search() {
    // Official API is own-apps only and requires a service account JSON.
    return [];
  },
  async fetchInbox(ctx) {
    if (!ctx.accessToken || !ctx.accountExternalId) return [];
    const data = await getJson<{ reviews?: { reviewId: string; comments?: { userComment?: { text?: string; lastModified?: { seconds?: string } } }[] }[] }>(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ctx.accountExternalId}/reviews`,
      { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
    );
    return (data.reviews ?? []).map((r) => ({
      externalId: r.reviewId,
      type: "REVIEW" as const,
      authorName: "Play reviewer",
      content: r.comments?.[0]?.userComment?.text ?? "",
      receivedAt: r.comments?.[0]?.userComment?.lastModified?.seconds
        ? new Date(Number(r.comments[0].userComment.lastModified.seconds) * 1000)
        : new Date(),
    })) satisfies InboxPayload[];
  },
};
