import { appConfig, env } from "../config";
import { getJson, postJson } from "./http";
import type { Connector, RawMention } from "./types";

type MastoStatus = {
  id: string;
  url?: string;
  content?: string;
  created_at?: string;
  favourites_count?: number;
  reblogs_count?: number;
  replies_count?: number;
  account?: { username?: string; display_name?: string; url?: string; followers_count?: number };
};

function stripHtml(html?: string) {
  return (html ?? "").replace(/<[^>]+>/g, "").trim();
}

function mapStatus(s: MastoStatus): RawMention {
  return {
    source: "MASTODON",
    externalId: s.id,
    url: s.url ?? "",
    content: stripHtml(s.content),
    authorName: s.account?.display_name || s.account?.username,
    authorHandle: s.account?.username,
    authorUrl: s.account?.url,
    publishedAt: s.created_at ? new Date(s.created_at) : new Date(),
    likeCount: s.favourites_count ?? 0,
    shareCount: s.reblogs_count ?? 0,
    commentCount: s.replies_count ?? 0,
    followerCount: s.account?.followers_count ?? 0,
    engagement: (s.favourites_count ?? 0) + (s.reblogs_count ?? 0) + (s.replies_count ?? 0),
    reach: s.account?.followers_count ?? 0,
    kind: "post",
    raw: s,
  };
}

export const mastodonConnector: Connector = {
  id: "MASTODON",
  name: "Mastodon",
  family: "Fediverse",
  docsUrl: "https://docs.joinmastodon.org/api/",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    const instances = ctx.projectConfig?.mastodonInstances?.length
      ? ctx.projectConfig.mastodonInstances
      : [appConfig.mastodonInstance];
    const out: RawMention[] = [];
    for (const instance of instances.slice(0, 4)) {
      const base = instance.replace(/\/$/, "");
      try {
        const data = await getJson<{ statuses?: MastoStatus[] } | MastoStatus[]>(
          `${base}/api/v2/search?q=${encodeURIComponent(ctx.query)}&type=statuses&resolve=true&limit=15`,
        );
        const statuses = Array.isArray(data) ? data : data.statuses ?? [];
        out.push(...statuses.map(mapStatus));
      } catch {
        try {
          const tag = ctx.query.replace(/^#/, "");
          const data = await getJson<MastoStatus[]>(`${base}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=15`);
          out.push(...data.map(mapStatus));
        } catch {
          // skip instance
        }
      }
    }
    return out;
  },
  async publish(input) {
    const instance = appConfig.mastodonInstance.replace(/\/$/, "");
    if (!input.accessToken) throw new Error("Mastodon publishing requires OAuth");
    const res = await postJson<MastoStatus>(
      `${instance}/api/v1/statuses`,
      { status: input.content },
      { Authorization: `Bearer ${input.accessToken}` },
    );
    return { externalId: res.id, url: res.url };
  },
};

void env;
