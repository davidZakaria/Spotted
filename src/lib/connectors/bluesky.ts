import { env } from "../config";
import { getJson, HttpError, postJson } from "./http";
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

export const BSKY_APPVIEWS = ["https://api.bsky.app", "https://public.api.bsky.app"] as const;

async function session() {
  const handle = env("BLUESKY_HANDLE");
  const password = env("BLUESKY_APP_PASSWORD");
  if (!handle || !password) return null;
  return postJson<{ accessJwt: string; did: string }>(
    "https://bsky.social/xrpc/com.atproto.server.createSession",
    { identifier: handle, password },
  );
}

function retryable(error: unknown) {
  return error instanceof HttpError && (error.status === 401 || error.status === 403 || error.status === 429 || error.status === 404);
}

export async function bskyXrpc<T>(path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  let last: unknown;
  for (const host of BSKY_APPVIEWS) {
    try {
      return await getJson<T>(`${host}${suffix}`);
    } catch (error) {
      last = error;
      if (!retryable(error)) throw error;
    }
  }
  const sess = await session();
  if (sess) {
    return getJson<T>(`https://api.bsky.app${suffix}`, {
      headers: { Authorization: `Bearer ${sess.accessJwt}` },
    });
  }
  throw last instanceof HttpError
    ? new HttpError(
        "Bluesky public search is blocked from this server. Add BLUESKY_HANDLE and BLUESKY_APP_PASSWORD.",
        last.status,
        last.body,
      )
    : last;
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
    const data = await bskyXrpc<{ posts?: BskyPost[] }>(
      `/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(ctx.query)}&limit=${ctx.limit ?? 25}`,
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
        const data = await bskyXrpc<{ feed?: { post: BskyPost }[] }>(
          `/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=10`,
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
