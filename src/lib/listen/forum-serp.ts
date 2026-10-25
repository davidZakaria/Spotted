import type { Source } from "@prisma/client";
import { hasRedditApp } from "@/lib/platform-status";
import { hasSerpApi, runSerpSearch } from "@/lib/listen/serpapi";
import type { ConnectorContext, RawMention } from "@/lib/connectors/types";

export type ForumSite = "reddit.com" | "quora.com";

export const QUORA_VIA_GOOGLE_NOTE = "Found through Google search";
export const QUORA_VIA_GOOGLE_NOTE_AR = "يُعثر عليها عبر بحث جوجل";

const FORUM_ORDER: ForumSite[] = ["reddit.com", "quora.com"];
const CACHE_TTL_MS = 120_000;

type ForumSerpRun = typeof runSerpSearch;
type CacheValue = { mentions: RawMention[]; skipped?: string };

const inflight = new Map<string, Promise<CacheValue>>();
const resolved = new Map<string, { at: number; value: CacheValue }>();

export function resetForumSerpCache() {
  inflight.clear();
  resolved.clear();
}

export function hasBraveSearch(e: Record<string, string | undefined> = process.env) {
  return Boolean(e.BRAVE_SEARCH_API_KEY?.trim());
}

export function searchQueryCap(source: Source, e: Record<string, string | undefined> = process.env) {
  if (source === "WEB_SEARCH" || source === "QUORA") return 1;
  if (source === "REDDIT" && !hasRedditApp(e)) return 1;
  if (source === "YOUTUBE") return 2;
  return 6;
}

export function forumSitesFor(want: ForumSite, e: Record<string, string | undefined> = process.env): ForumSite[] {
  if (!hasSerpApi(e)) return [];
  const include = new Set<ForumSite>([want]);
  if (!hasRedditApp(e)) include.add("reddit.com");
  if (!hasBraveSearch(e)) include.add("quora.com");
  return FORUM_ORDER.filter((site) => include.has(site));
}

export function forumSerpQuery(keyword: string, sites: ForumSite[]) {
  const unique = FORUM_ORDER.filter((site) => sites.includes(site));
  if (!unique.length) return keyword.trim();
  const clause =
    unique.length === 1 ? `site:${unique[0]}` : `(${unique.map((site) => `site:${site}`).join(" OR ")})`;
  const q = keyword.trim();
  if (!q) return clause;
  if (/\bsite:(?:reddit|quora)\.com\b/i.test(q)) return q;
  return `${clause} ${q}`;
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function mentionMatchesForumSite(mention: Pick<RawMention, "url">, site: ForumSite) {
  const host = hostOf(mention.url);
  if (!host) return false;
  return host === site || host.endsWith(`.${site}`);
}

export function labelViaGoogle(mentions: RawMention[], source: "REDDIT" | "QUORA"): RawMention[] {
  return mentions.map((mention) => ({
    ...mention,
    source,
    kind: "via_google",
  }));
}

export function splitForumMentions(mentions: RawMention[]) {
  return {
    reddit: labelViaGoogle(
      mentions.filter((mention) => mentionMatchesForumSite(mention, "reddit.com")),
      "REDDIT",
    ),
    quora: labelViaGoogle(
      mentions.filter((mention) => mentionMatchesForumSite(mention, "quora.com")),
      "QUORA",
    ),
  };
}

function cacheKey(ctx: ConnectorContext, sites: ForumSite[]) {
  return [ctx.workspaceId ?? "", ctx.purpose ?? "scheduled", ctx.keywordKey ?? ctx.query, sites.join(",")].join("\0");
}

async function runCombined(
  ctx: ConnectorContext,
  sites: ForumSite[],
  run: ForumSerpRun,
): Promise<CacheValue> {
  const serp = await run({
    query: forumSerpQuery(ctx.query, sites),
    engine: "google",
    purpose: ctx.purpose ?? "scheduled",
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId,
    keywordKey: ctx.keywordKey ?? ctx.query,
    language: ctx.language,
    country: ctx.country,
    source: sites.length > 1 ? "WEB_SEARCH" : sites[0] === "reddit.com" ? "REDDIT" : "QUORA",
  });
  return { mentions: serp.mentions, skipped: serp.skipped };
}

export async function searchForumsViaGoogle(
  ctx: ConnectorContext,
  want: ForumSite,
  deps?: { run?: ForumSerpRun; env?: Record<string, string | undefined> },
): Promise<RawMention[]> {
  const e = deps?.env ?? process.env;
  const run = deps?.run ?? runSerpSearch;
  const sites = forumSitesFor(want, e);
  if (!sites.length) return [];

  const key = cacheKey(ctx, sites);
  const now = Date.now();
  const hit = resolved.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    const split = splitForumMentions(hit.value.mentions);
    return want === "reddit.com" ? split.reddit : split.quora;
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = runCombined(ctx, sites, run).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  const value = await pending;
  resolved.set(key, { at: Date.now(), value });
  const split = splitForumMentions(value.mentions);
  return want === "reddit.com" ? split.reddit : split.quora;
}
