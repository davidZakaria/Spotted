import type { Source } from "@prisma/client";
import type { RawMention } from "@/lib/connectors/types";

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
