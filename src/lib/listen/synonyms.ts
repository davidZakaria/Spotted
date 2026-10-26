import type { Source } from "@prisma/client";
import { isArabicText, normalizeText, type KeywordRule } from "./query";

export const SERP_QUERY_WORD_LIMIT = 32;
export const FREE_SPLIT_QUERY_CAP = 48;
export const FREE_SPLIT_SOURCES: Source[] = ["GOOGLE_NEWS", "HACKER_NEWS", "BLUESKY", "MASTODON"];

export function watchTerms(rule: Pick<KeywordRule, "phrase" | "synonyms">) {
  return [...new Set([rule.phrase, ...(rule.synonyms ?? [])].map((term) => term.trim()).filter(Boolean))];
}

export function distinctKey(term: string) {
  return normalizeText(term).replace(/\s+/g, "");
}

export function distinctWatchTerms(rule: Pick<KeywordRule, "phrase" | "synonyms">) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of watchTerms(rule)) {
    const key = distinctKey(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

export function serpTerm(term: string) {
  const cleaned = term.trim().replace(/"/g, "");
  return /\s/.test(cleaned) ? `"${cleaned}"` : cleaned;
}

export function queryWordCount(query: string) {
  return query.split(/\s+/).filter(Boolean).length;
}

export function packSerpOrQuery(terms: string[], wordLimit = SERP_QUERY_WORD_LIMIT) {
  return packSerpTerms(terms, wordLimit)
    .map(serpTerm)
    .join(" OR ");
}

export function packSerpTerms(terms: string[], wordLimit = SERP_QUERY_WORD_LIMIT) {
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    const key = distinctKey(trimmed);
    if (seen.has(key)) continue;
    const next = [...selected, trimmed].map(serpTerm).join(" OR ");
    if (queryWordCount(next) > wordLimit) continue;
    seen.add(key);
    selected.push(trimmed);
  }
  return selected;
}

export function synonymSignal(term: string, phrase: string, preferArabic = false) {
  const trimmed = term.trim();
  let score = Math.min(trimmed.length, 28) / 7;
  if (isArabicText(trimmed)) score += preferArabic ? 6 : 3;
  if (trimmed.split(/\s+/).length >= 2) score += 2;
  if (distinctKey(trimmed) === distinctKey(phrase)) score -= 12;
  if (trimmed.length <= 2) score -= 3;
  return score;
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return [];
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

export function synonymRotationSlot(seed: string, now = new Date()) {
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = Math.floor(utc / 86_400_000);
  const half = now.getUTCHours() < 12 ? 0 : 1;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) + day * 2 + half;
}

export function selectSerpSynonyms(
  rule: Pick<KeywordRule, "phrase" | "synonyms" | "language" | "country">,
  opts: { rotation?: number; wordLimit?: number; rotateLeftovers?: boolean; preferArabic?: boolean } = {},
) {
  const wordLimit = opts.wordLimit ?? SERP_QUERY_WORD_LIMIT;
  const phrase = rule.phrase.trim();
  const preferArabic = opts.preferArabic ?? (isArabicText(phrase) || rule.language?.toLowerCase() === "ar");
  const others = distinctWatchTerms(rule)
    .filter((term) => distinctKey(term) !== distinctKey(phrase))
    .sort(
      (a, b) =>
        synonymSignal(b, phrase, preferArabic) - synonymSignal(a, phrase, preferArabic) || a.localeCompare(b, "en"),
    );
  const rotation = opts.rotation ?? 0;
  const rotateLeftovers = opts.rotateLeftovers !== false && others.length > 0;
  const maxFit = packSerpTerms([phrase, ...others], wordLimit);
  const extraFit = Math.max(0, maxFit.length - 1);
  const leftoverCount = Math.max(0, others.length - extraFit);
  const rotateSlots =
    rotateLeftovers && leftoverCount > 0 ? Math.max(1, Math.min(4, Math.floor(extraFit / 3) || 1)) : 0;
  const coreSlots = Math.max(0, extraFit - rotateSlots);
  const core = others.slice(0, coreSlots);
  const leftovers = others.slice(coreSlots);
  const rotated = rotate(leftovers, rotation * Math.max(rotateSlots, 1));
  const selected = packSerpTerms([phrase, ...core, ...rotated], wordLimit);
  const selectedKeys = new Set(selected.map(distinctKey));
  return {
    query: selected.map(serpTerm).join(" OR "),
    selected,
    remaining: others.filter((term) => !selectedKeys.has(distinctKey(term))),
  };
}

export function appendSerpExcludes(query: string, excludes: string[] | undefined, wordLimit = SERP_QUERY_WORD_LIMIT) {
  let next = query.trim();
  if (!next) return next;
  for (const term of excludes ?? []) {
    const cleaned = term.trim().replace(/"/g, "");
    if (!cleaned) continue;
    const extra = ` -${serpTerm(cleaned)}`;
    if (queryWordCount(next + extra) > wordLimit) continue;
    next += extra;
  }
  return next;
}

export function sourceUsesPackedSerpQuery(
  source: Source,
  e: Record<string, string | undefined> = process.env,
) {
  if (source === "WEB_SEARCH") return true;
  if (source === "QUORA" && !e.BRAVE_SEARCH_API_KEY?.trim()) return true;
  if (source === "REDDIT" && !(e.REDDIT_CLIENT_ID?.trim() && e.REDDIT_CLIENT_SECRET?.trim())) return true;
  return false;
}
