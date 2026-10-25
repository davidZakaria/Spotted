import type { Source } from "@prisma/client";
import type { RawMention } from "@/lib/connectors/types";
import { arabicTerms, type KeywordRule } from "@/lib/listen/query";

export { arabicTerms };

export const INGEST_DAYS = 30;
export const BACKFILL_DAYS = 365;
export const HISTORY_SCAN_KIND = "history_scan";
export const HISTORY_SCAN_LABEL = "Found in history scan";
export const HISTORY_SCAN_LABEL_AR = "وُجدت في مسح التاريخ";

export const BACKFILL_SOURCES: Source[] = [
  "GOOGLE_NEWS",
  "HACKER_NEWS",
  "BLUESKY",
  "MASTODON",
  "YOUTUBE",
  "PODCASTS",
];

export function lookbackSince(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export { egyptNewsRssUrl } from "@/lib/connectors/google";

export function targetsEgypt(input: {
  country?: string | null;
  languages?: string[];
  timezone?: string | null;
}) {
  const country = (input.country ?? "").trim().toUpperCase();
  if (country === "EG" || country === "EGYPT") return true;
  if ((input.languages ?? []).some((item) => /^(ar|eg)([-_]|$)/i.test(item.trim()) || item.trim().toUpperCase() === "EG")) {
    return true;
  }
  return /cairo|egypt|africa\/cairo/i.test(input.timezone ?? "");
}

export function wantsArabicCoverage(
  rule: Pick<KeywordRule, "phrase" | "synonyms" | "language" | "country">,
  extras: { languages?: string[]; timezone?: string | null } = {},
) {
  if (arabicTerms(rule).length) return true;
  if (rule.language?.toLowerCase() === "ar") return true;
  return targetsEgypt({ country: rule.country, languages: extras.languages, timezone: extras.timezone });
}

function serpTerm(term: string) {
  const cleaned = term.trim().replace(/"/g, "");
  return /[\s]/.test(cleaned) ? `"${cleaned}"` : cleaned;
}

export function backfillSerpQuery(
  rule: Pick<KeywordRule, "phrase" | "synonyms" | "language" | "country">,
  extras: { languages?: string[]; timezone?: string | null } = {},
) {
  const arabic = arabicTerms(rule);
  const egypt = wantsArabicCoverage(rule, extras);
  const terms = [rule.phrase, ...arabic].map((term) => term.trim()).filter(Boolean);
  const unique = [...new Set(terms)];
  return {
    query: unique.map(serpTerm).join(" OR "),
    language: egypt ? "ar" : rule.language ?? undefined,
    country: egypt ? "eg" : rule.country ?? undefined,
  };
}

export function markHistoryScan(mention: RawMention): RawMention {
  return {
    ...mention,
    kind: HISTORY_SCAN_KIND,
    raw: {
      ...(typeof mention.raw === "object" && mention.raw ? mention.raw : {}),
      originalKind: mention.kind ?? null,
      historyScan: true,
    },
  };
}
