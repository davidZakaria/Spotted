import type { RawMention } from "@/lib/connectors/types";

export function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|si$)/i.test(key)) parsed.searchParams.delete(key);
    }
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");
    const query = parsed.searchParams.toString();
    return `${parsed.protocol}//${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return url.trim();
  }
}

export function mentionFingerprint(mention: Pick<RawMention, "title" | "content" | "authorHandle" | "authorName">) {
  const text = `${mention.title ?? ""} ${mention.content}`.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 96);
  const author = (mention.authorHandle || mention.authorName || "").toLowerCase();
  return `${author}::${text}`;
}

export function dedupeMentions<T extends Pick<RawMention, "source" | "externalId" | "url" | "title" | "content" | "authorHandle" | "authorName">>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const keys = [
      `${item.source}:${String(item.externalId)}`,
      item.url ? normalizeUrl(item.url) : "",
      mentionFingerprint(item),
    ].filter(Boolean);
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    out.push(item);
  }
  return out;
}

export function influenceScore(mention: {
  reach?: number | null;
  viewCount?: number | null;
  followerCount?: number | null;
  engagement?: number | null;
  likeCount?: number | null;
  shareCount?: number | null;
  commentCount?: number | null;
}) {
  return (
    (mention.reach ?? 0) +
    (mention.viewCount ?? 0) +
    (mention.followerCount ?? 0) +
    (mention.engagement ?? 0) * 2 +
    (mention.likeCount ?? 0) +
    (mention.shareCount ?? 0) +
    (mention.commentCount ?? 0)
  );
}
