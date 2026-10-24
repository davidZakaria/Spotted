import { env } from "../config";
import { getJson, postJson } from "./http";
import type { Connector, RawMention } from "./types";

type BskyPost = {
  uri: string;
  cid?: string;
  author?: { handle?: string; displayName?: string; followersCount?: number };
  record?: { text?: string; createdAt?: string };
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
};

async function session() {
  const handle = env("BLUESKY_HANDLE");
  const password = env("BLUESKY_APP_PASSWORD");
  if (!handle || !password) return null;
  return postJson<{ accessJwt: string; did: string }>(
    "https://bsky.social/xrpc/com.atproto.server.createSession",
    { identifier: handle, password },
  );
}

export const blueskyConnector: Connector = {
  id: "BLUESKY",
  name: "Bluesky",
  family: "AT Protocol",
  docsUrl: "https://docs.bsky.app/",
  keyless: true,
  capabilities: [],
  isConfigured: () => true,
  async search(ctx) {
    const data = await getJson<{ posts?: BskyPost[] }>(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(ctx.query)}&limit=${ctx.limit ?? 25}`,
    );
    return (data.posts ?? []).map((p) => ({
      source: "BLUESKY" as const,
      externalId: p.uri,
      url: `https://bsky.app/profile/${p.author?.handle}/post/${p.uri.split("/").pop()}`,
      content: p.record?.text ?? "",
      authorName: p.author?.displayName || p.author?.handle,
      authorHandle: p.author?.handle,
      authorUrl: p.author?.handle ? `https://bsky.app/profile/${p.author.handle}` : undefined,
      publishedAt: p.record?.createdAt ? new Date(p.record.createdAt) : new Date(),
      likeCount: p.likeCount ?? 0,
      shareCount: p.repostCount ?? 0,
      commentCount: p.replyCount ?? 0,
      followerCount: p.author?.followersCount ?? 0,
      engagement: (p.likeCount ?? 0) + (p.repostCount ?? 0) + (p.replyCount ?? 0),
      reach: p.author?.followersCount ?? 0,
      kind: "post",
      raw: p,
    }));
  },
  async trackAccounts(ctx) {
    const handles = ctx.projectConfig?.competitors ?? [];
    const out: RawMention[] = [];
    for (const handle of handles.slice(0, 6)) {
      try {
        const data = await getJson<{ feed?: { post: BskyPost }[] }>(
          `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=10`,
        );
        for (const row of data.feed ?? []) {
          const p = row.post;
          out.push({
            source: "BLUESKY",
            externalId: p.uri,
            url: `https://bsky.app/profile/${p.author?.handle}/post/${p.uri.split("/").pop()}`,
            content: p.record?.text ?? "",
            authorName: p.author?.displayName || p.author?.handle,
            authorHandle: p.author?.handle,
            publishedAt: p.record?.createdAt ? new Date(p.record.createdAt) : new Date(),
            likeCount: p.likeCount ?? 0,
            kind: "post",
          });
        }
      } catch {
        // skip
      }
    }
    return out;
  },
  async publish(input) {
    const sess = input.accessToken
      ? { accessJwt: input.accessToken, did: input.accountExternalId ?? "" }
      : await session();
    if (!sess) throw new Error("Bluesky publishing requires an app password or OAuth session");
    const res = await postJson<{ uri: string }>(
      "https://bsky.social/xrpc/com.atproto.repo.createRecord",
      {
        repo: sess.did,
        collection: "app.bsky.feed.post",
        record: { $type: "app.bsky.feed.post", text: input.content, createdAt: new Date().toISOString() },
      },
      { Authorization: `Bearer ${sess.accessJwt}` },
    );
    return { externalId: res.uri };
  },
};
