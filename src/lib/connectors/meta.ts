import { appConfig, env } from "../config";
import { getJson, postJson } from "./http";
import { consumeInstagramHashtag } from "./quotas";
import type { Connector, InboxPayload, RawMention } from "./types";

const version = () => appConfig.graphVersion;

function graphUrl(path: string, params: Record<string, string> = {}) {
  const usp = new URLSearchParams(params);
  return `https://graph.facebook.com/${version()}${path}?${usp}`;
}

function token(explicit?: string) {
  return explicit || env("META_PAGE_ACCESS_TOKEN");
}

type FbPost = {
  id: string;
  message?: string;
  story?: string;
  created_time?: string;
  permalink_url?: string;
  from?: { name?: string; id?: string };
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number }; data?: { id: string; message?: string; from?: { name?: string }; created_time?: string }[] };
};

function mapPost(p: FbPost, source: "FACEBOOK" | "INSTAGRAM" | "THREADS", kind = "post"): RawMention {
  return {
    source,
    externalId: p.id,
    url: p.permalink_url ?? `https://www.facebook.com/${p.id}`,
    content: p.message || p.story || "",
    authorName: p.from?.name,
    authorHandle: p.from?.id,
    publishedAt: p.created_time ? new Date(p.created_time) : new Date(),
    likeCount: p.reactions?.summary?.total_count ?? 0,
    shareCount: p.shares?.count ?? 0,
    commentCount: p.comments?.summary?.total_count ?? 0,
    engagement:
      (p.reactions?.summary?.total_count ?? 0) +
      (p.shares?.count ?? 0) +
      (p.comments?.summary?.total_count ?? 0),
    reach: p.reactions?.summary?.total_count ?? 0,
    kind,
    raw: p,
  };
}

export function resolveFacebookPages(ctx: {
  accessToken?: string;
  accountExternalId?: string;
  projectConfig?: { facebookPageIds?: string[] };
}): { id: string; token: string }[] {
  const pages: { id: string; token: string }[] = [];
  const seen = new Set<string>();
  const fallback = token(ctx.accessToken);
  if (ctx.accountExternalId && ctx.accessToken) {
    pages.push({ id: ctx.accountExternalId, token: ctx.accessToken });
    seen.add(ctx.accountExternalId);
  }
  for (const id of ctx.projectConfig?.facebookPageIds ?? []) {
    if (!id || seen.has(id) || !fallback) continue;
    pages.push({ id, token: fallback });
    seen.add(id);
  }
  return pages;
}

function matchesQuery(text: string, query?: string) {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

async function listPagePosts(pageId: string, accessToken: string) {
  return getJson<{ data?: FbPost[] }>(
    graphUrl(`/${pageId}/posts`, {
      access_token: accessToken,
      fields: "id,message,story,created_time,permalink_url,from,shares,reactions.summary(true),comments.summary(true).limit(5)",
      limit: "10",
    }),
  );
}

async function listPageTagged(pageId: string, accessToken: string) {
  return getJson<{ data?: FbPost[] }>(
    graphUrl(`/${pageId}/tagged`, {
      access_token: accessToken,
      fields: "id,message,story,created_time,permalink_url,from",
      limit: "10",
    }),
  );
}

async function listPostComments(postId: string, accessToken: string) {
  return getJson<{ data?: { id: string; message?: string; from?: { name?: string; id?: string }; created_time?: string }[] }>(
    graphUrl(`/${postId}/comments`, {
      access_token: accessToken,
      fields: "id,message,from,created_time",
      limit: "25",
    }),
  );
}

export const facebookConnector: Connector = {
  id: "FACEBOOK",
  name: "Facebook Pages",
  family: "Meta",
  docsUrl: "https://developers.facebook.com/docs/graph-api",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("META_APP_ID") || env("META_PAGE_ACCESS_TOKEN")),
  async search(ctx) {
    const pages = resolveFacebookPages(ctx);
    if (!pages.length) return [];
    const out: RawMention[] = [];
    for (const page of pages.slice(0, 8)) {
      try {
        const data = await listPagePosts(page.id, page.token);
        const posts = (data.data ?? []).filter((p) => matchesQuery(`${p.message ?? ""} ${p.story ?? ""}`, ctx.query));
        out.push(...posts.map((p) => mapPost(p, "FACEBOOK")));
        for (const post of posts.slice(0, 8)) {
          try {
            const comments = await listPostComments(post.id, page.token);
            for (const comment of comments.data ?? []) {
              if (!matchesQuery(comment.message ?? "", ctx.query) && ctx.query) continue;
              out.push({
                source: "FACEBOOK",
                externalId: comment.id,
                url: `https://www.facebook.com/${comment.id}`,
                content: comment.message ?? "",
                authorName: comment.from?.name,
                authorHandle: comment.from?.id,
                publishedAt: comment.created_time ? new Date(comment.created_time) : new Date(),
                kind: "comment",
                parentExternalId: post.id,
              });
            }
          } catch {
            // comments permission may be missing
          }
        }
      } catch {
        // page token may be expired
      }
      try {
        const tagged = await listPageTagged(page.id, page.token);
        for (const post of tagged.data ?? []) {
          if (!matchesQuery(`${post.message ?? ""} ${post.story ?? ""}`, ctx.query)) continue;
          out.push(mapPost(post, "FACEBOOK", "mention"));
        }
      } catch {
        // tagged feed needs pages_read_engagement
      }
    }
    return out;
  },
  async trackAccounts(ctx) {
    return this.search!(ctx);
  },
  async fetchComments(ctx) {
    const t = token(ctx.accessToken);
    if (!t) return [];
    const data = await getJson<{ data?: { id: string; message?: string; from?: { name?: string }; created_time?: string }[] }>(
      graphUrl(`/${ctx.externalId}/comments`, {
        access_token: t,
        fields: "id,message,from,created_time",
        limit: "25",
      }),
    );
    return (data.data ?? []).map((c) => ({
      source: "FACEBOOK" as const,
      externalId: c.id,
      url: `https://www.facebook.com/${c.id}`,
      content: c.message ?? "",
      authorName: c.from?.name,
      publishedAt: c.created_time ? new Date(c.created_time) : new Date(),
      kind: "comment",
      parentExternalId: ctx.externalId,
    }));
  },
  async fetchInbox(ctx) {
    const t = token(ctx.accessToken);
    if (!t || !ctx.accountExternalId) return [];
    const items: InboxPayload[] = [];
    const comments = await getJson<{ data?: { id: string; message?: string; from?: { name?: string }; created_time?: string }[] }>(
      graphUrl(`/${ctx.accountExternalId}/feed`, {
        access_token: t,
        fields: "comments{id,message,from,created_time}",
        limit: "10",
      }),
    );
    for (const post of comments.data ?? []) {
      items.push({
        externalId: post.id,
        type: "COMMENT",
        authorName: post.from?.name ?? "Page visitor",
        content: post.message ?? "",
        receivedAt: post.created_time ? new Date(post.created_time) : new Date(),
      });
    }
    try {
      const convos = await getJson<{ data?: { id: string; updated_time?: string }[] }>(
        graphUrl(`/${ctx.accountExternalId}/conversations`, { access_token: t, fields: "id,updated_time", limit: "10" }),
      );
      for (const c of convos.data ?? []) {
        items.push({
          externalId: c.id,
          type: "MESSAGE",
          authorName: "Messenger",
          content: "Messenger conversation",
          receivedAt: c.updated_time ? new Date(c.updated_time) : new Date(),
        });
      }
    } catch {
      // Messenger permission may be missing
    }
    try {
      const ratings = await getJson<{ data?: { open_graph_story?: { id?: string }; reviewer?: { name?: string }; created_time?: string; review_text?: string }[] }>(
        graphUrl(`/${ctx.accountExternalId}/ratings`, { access_token: t, fields: "reviewer,review_text,created_time,open_graph_story", limit: "10" }),
      );
      for (const r of ratings.data ?? []) {
        items.push({
          externalId: r.open_graph_story?.id ?? `${ctx.accountExternalId}:review:${r.created_time}`,
          type: "REVIEW",
          authorName: r.reviewer?.name ?? "Reviewer",
          content: r.review_text ?? "",
          receivedAt: r.created_time ? new Date(r.created_time) : new Date(),
        });
      }
    } catch {
      // ratings permission
    }
    return items;
  },
  async publish(input) {
    if (!input.accessToken || !input.accountExternalId) throw new Error("Facebook publishing requires a Page token");
    const res = await postJson<{ id: string }>(
      graphUrl(`/${input.accountExternalId}/feed`, { access_token: input.accessToken, message: input.content }),
      {},
    );
    return { externalId: res.id };
  },
  async reply(ctx) {
    const t = token(ctx.accessToken);
    if (!t) throw new Error("Facebook reply requires a Page token");
    await postJson(graphUrl(`/${ctx.externalId}/comments`, { access_token: t, message: ctx.message }), {});
  },
  async ownAnalytics(ctx) {
    const t = token(ctx.accessToken);
    if (!t || !ctx.accountExternalId) {
      return { followers: 0, impressions: 0, engagements: 0, period: "28d", series: [] };
    }
    const data = await getJson<{ fan_count?: number }>(
      graphUrl(`/${ctx.accountExternalId}`, { access_token: t, fields: "fan_count" }),
    );
    return { followers: data.fan_count ?? 0, impressions: 0, engagements: 0, period: "28d", series: [] };
  },
};

export const instagramConnector: Connector = {
  id: "INSTAGRAM",
  name: "Instagram",
  family: "Meta",
  docsUrl: "https://developers.facebook.com/docs/instagram-api",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("META_APP_ID")),
  async search(ctx) {
    const t = token(ctx.accessToken);
    const igUser = ctx.accountExternalId || ctx.projectConfig?.instagramUserIds?.[0];
    const tags = ctx.projectConfig?.instagramHashtags?.length
      ? ctx.projectConfig.instagramHashtags
      : ctx.query
        ? [ctx.query.replace(/\s+/g, "")]
        : [];
    if (!t || !igUser || !tags.length) return [];
    const out: RawMention[] = [];
    for (const tag of tags.slice(0, 8)) {
      const clean = tag.replace(/^#/, "");
      const quota = await consumeInstagramHashtag({
        accountId: ctx.accountId,
        hashtag: clean,
        projectId: ctx.projectId,
      });
      if (!quota.allowed) continue;
      const found = await getJson<{ data?: { id: string }[] }>(
        graphUrl(`/ig_hashtag_search`, { user_id: igUser, q: clean, access_token: t }),
      );
      const hashtagId = found.data?.[0]?.id;
      if (!hashtagId) continue;
      const media = await getJson<{ data?: { id: string; caption?: string; permalink?: string; timestamp?: string; like_count?: number; comments_count?: number; username?: string }[] }>(
        graphUrl(`/${hashtagId}/recent_media`, {
          user_id: igUser,
          fields: "id,caption,permalink,timestamp,like_count,comments_count,username",
          access_token: t,
        }),
      );
      for (const m of media.data ?? []) {
        out.push({
          source: "INSTAGRAM",
          externalId: m.id,
          url: m.permalink ?? `https://www.instagram.com/p/${m.id}`,
          content: m.caption ?? `#${clean}`,
          authorName: m.username,
          authorHandle: m.username,
          publishedAt: m.timestamp ? new Date(m.timestamp) : new Date(),
          likeCount: m.like_count ?? 0,
          commentCount: m.comments_count ?? 0,
          engagement: (m.like_count ?? 0) + (m.comments_count ?? 0),
          kind: "post",
        });
      }
    }
    return out;
  },
  async trackAccounts(ctx) {
    const t = token(ctx.accessToken);
    const igUser = ctx.accountExternalId || ctx.projectConfig?.instagramUserIds?.[0];
    const handles = ctx.projectConfig?.competitors ?? [];
    if (!t || !igUser) return [];
    const out: RawMention[] = [];
    for (const handle of handles.slice(0, 5)) {
      try {
        const data = await getJson<{ id?: string; media?: { data?: { id: string; caption?: string; permalink?: string; timestamp?: string }[] } }>(
          graphUrl(`/${igUser}`, {
            fields: `business_discovery.username(${handle.replace("@", "")}){id,media.limit(8){id,caption,permalink,timestamp}}`,
            access_token: t,
          }),
        );
        for (const m of data.media?.data ?? []) {
          out.push({
            source: "INSTAGRAM",
            externalId: m.id,
            url: m.permalink ?? "",
            content: m.caption ?? "",
            authorHandle: handle,
            publishedAt: m.timestamp ? new Date(m.timestamp) : new Date(),
            kind: "post",
          });
        }
      } catch {
        // business discovery may fail for personal accounts
      }
    }
    return out;
  },
  async fetchInbox(ctx) {
    const t = token(ctx.accessToken);
    if (!t || !ctx.accountExternalId) return [];
    const data = await getJson<{ data?: { id: string; caption?: string; timestamp?: string; comments?: { data?: { id: string; text?: string; username?: string; timestamp?: string }[] } }[] }>(
      graphUrl(`/${ctx.accountExternalId}/media`, {
        fields: "id,caption,timestamp,comments{id,text,username,timestamp}",
        access_token: t,
      }),
    );
    const items: InboxPayload[] = [];
    for (const m of data.data ?? []) {
      for (const c of m.comments?.data ?? []) {
        items.push({
          externalId: c.id,
          type: "COMMENT",
          authorName: c.username ?? "ig user",
          content: c.text ?? "",
          receivedAt: c.timestamp ? new Date(c.timestamp) : new Date(),
        });
      }
    }
    return items;
  },
  async publish(input) {
    if (!input.accessToken || !input.accountExternalId) throw new Error("Instagram publishing requires a connected Business/Creator account");
    const container = await postJson<{ id: string }>(
      graphUrl(`/${input.accountExternalId}/media`, {
        access_token: input.accessToken,
        caption: input.content,
        image_url: input.mediaUrls?.[0] ?? "",
      }),
      {},
    );
    const pub = await postJson<{ id: string }>(
      graphUrl(`/${input.accountExternalId}/media_publish`, {
        access_token: input.accessToken,
        creation_id: container.id,
      }),
      {},
    );
    return { externalId: pub.id };
  },
  async reply(ctx) {
    const t = token(ctx.accessToken);
    if (!t) throw new Error("Instagram reply requires OAuth");
    await postJson(graphUrl(`/${ctx.externalId}/replies`, { access_token: t, message: ctx.message }), {});
  },
};

export const threadsConnector: Connector = {
  id: "THREADS",
  name: "Threads",
  family: "Meta",
  docsUrl: "https://developers.facebook.com/docs/threads",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("THREADS_APP_ID") || env("META_APP_ID")),
  async search(ctx) {
    if (!ctx.accessToken) return [];
    const data = await getJson<{ data?: { id: string; text?: string; timestamp?: string; permalink?: string; username?: string }[] }>(
      `https://graph.threads.net/${version()}/keyword_search?q=${encodeURIComponent(ctx.query)}&search_type=RECENT&access_token=${ctx.accessToken}`,
    );
    return (data.data ?? []).map((t) => ({
      source: "THREADS" as const,
      externalId: t.id,
      url: t.permalink ?? "",
      content: t.text ?? "",
      authorHandle: t.username,
      publishedAt: t.timestamp ? new Date(t.timestamp) : new Date(),
      kind: "post",
    }));
  },
  async publish(input) {
    if (!input.accessToken || !input.accountExternalId) throw new Error("Threads publishing requires OAuth");
    const container = await postJson<{ id: string }>(
      `https://graph.threads.net/${version()}/${input.accountExternalId}/threads?media_type=TEXT&text=${encodeURIComponent(input.content)}&access_token=${input.accessToken}`,
      {},
    );
    const pub = await postJson<{ id: string }>(
      `https://graph.threads.net/${version()}/${input.accountExternalId}/threads_publish?creation_id=${container.id}&access_token=${input.accessToken}`,
      {},
    );
    return { externalId: pub.id };
  },
  async reply(ctx) {
    if (!ctx.accessToken || !ctx.accountExternalId) throw new Error("Threads reply requires OAuth");
    await postJson(
      `https://graph.threads.net/${version()}/${ctx.accountExternalId}/threads?media_type=TEXT&text=${encodeURIComponent(ctx.message)}&reply_to_id=${ctx.externalId}&access_token=${ctx.accessToken}`,
      {},
    );
  },
};
