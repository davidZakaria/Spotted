import type { Source } from "@prisma/client";
import type { RawMention } from "@/lib/connectors/types";
import { arabicTerms, type KeywordRule } from "@/lib/listen/query";
import { selectSerpSynonyms, serpTerm } from "@/lib/listen/synonyms";

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

export function backfillSerpQuery(
  rule: Pick<KeywordRule, "phrase" | "synonyms" | "language" | "country">,
  extras: {
    languages?: string[];
    timezone?: string | null;
    rotation?: number;
    rotateLeftovers?: boolean;
  } = {},
) {
  const egypt = wantsArabicCoverage(rule, extras);
  const packed = selectSerpSynonyms(rule, {
    rotation: extras.rotation ?? 0,
    rotateLeftovers: extras.rotateLeftovers ?? false,
    preferArabic: egypt,
  });
  return {
    query: packed.query,
    selected: packed.selected,
    remaining: packed.remaining,
    language: egypt ? "ar" : rule.language ?? undefined,
    country: egypt ? "eg" : rule.country ?? undefined,
  };
}

export { serpTerm };

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
