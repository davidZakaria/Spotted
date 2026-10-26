import { env } from "@/lib/config";
import { getJson } from "@/lib/connectors/http";
import type { GoogleMapsPlace, RawMention } from "@/lib/connectors/types";
import { parsePublishedAt } from "./dates";
import { isArabicText } from "./query";
import type { SentimentResult } from "../sentiment";
import {
  assertSerpCall,
  hasSerpApi,
  recordSerpCall,
  serpBudgetLow,
  serpUsageSummary,
} from "./serpapi";

const DATA_ID = /0x[0-9a-f]+:0x[0-9a-f]+/i;
const PLACE_ID = /\bChIJ[A-Za-z0-9_-]{10,}\b/;

export const DEFAULT_MAPS_INTERVAL_HOURS = 24;
export const CAIRO_MAPS_LL = "@30.0444,31.2357,12z";

export function mapsIntervalHours(value?: number) {
  if (!Number.isFinite(value) || !value || value < 1) return DEFAULT_MAPS_INTERVAL_HOURS;
  return Math.min(Math.floor(value), 168);
}

export function parseMapsPlaceInput(input: string) {
  const raw = input.trim();
  const dataId = raw.match(DATA_ID)?.[0];
  const placeId = raw.match(PLACE_ID)?.[0];
  let query = raw;
  try {
    const url = new URL(raw);
    if (/google\.[^/]+\/maps/i.test(url.href) || url.hostname.includes("maps.google.")) {
      const place = decodeURIComponent(url.pathname.split("/place/")[1]?.split("/")[0] ?? "").replace(/\+/g, " ");
      if (place) query = place;
    }
  } catch {
    // not a URL
  }
  return {
    dataId: dataId || undefined,
    placeId: placeId || undefined,
    query,
    mapsUrl: /^https?:\/\//i.test(raw) ? raw : undefined,
  };
}

export function placeNeedsResolve(place: Pick<GoogleMapsPlace, "dataId" | "placeId">) {
  return !place.dataId && !place.placeId;
}

export function placeIsDue(place: GoogleMapsPlace, intervalHours = DEFAULT_MAPS_INTERVAL_HOURS, now = new Date()) {
  if (!place.lastFetchedAt) return true;
  const then = new Date(place.lastFetchedAt);
  if (Number.isNaN(then.getTime())) return true;
  return now.getTime() - then.getTime() >= mapsIntervalHours(intervalHours) * 60 * 60 * 1000;
}

export type MapsLocal = {
  data_id?: string;
  place_id?: string;
  title?: string;
  address?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
};

export function pickCairoMapsPlace(results: MapsLocal[], query: string) {
  if (!results.length) return undefined;
  const q = query.toLowerCase();
  const scored = results.map((row) => {
    let score = 0;
    const title = (row.title ?? "").toLowerCase();
    const address = (row.address ?? "").toLowerCase();
    if (title.includes("new jersey") || title.includes("njd")) score += 5;
    if (title.includes(q) || q.includes(title.slice(0, 12))) score += 3;
    if (/cairo|مصر|nasr city|new capital|ain sokhna|sokhna|north coast|الساحل|القاهرة/i.test(address + title)) {
      score += 8;
    }
    if (row.data_id) score += 1;
    return { row, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.row;
}

export type MapsReviewRow = {
  review_id?: string;
  rating?: number;
  snippet?: string;
  extracted_snippet?: { original?: string };
  date?: string;
  iso_date?: string;
  iso_date_of_last_edit?: string;
  link?: string;
  user?: { name?: string; link?: string };
};

export function applyReviewSentiment(result: SentimentResult, rating?: number): SentimentResult {
  if (rating != null && rating <= 2) {
    return {
      sentiment: "NEGATIVE",
      sentimentScore: Math.min(result.sentimentScore, -0.6),
      complaint: true,
    };
  }
  return result;
}

export function mentionFromMapsReview(
  row: MapsReviewRow,
  place: { label: string; mapsUrl?: string; dataId?: string; placeId?: string },
): RawMention | null {
  const id = row.review_id || row.link;
  const text = row.extracted_snippet?.original || row.snippet || "";
  if (!id && !text) return null;
  const rating = typeof row.rating === "number" ? row.rating : undefined;
  const stars = rating != null ? `${rating}★ ` : "";
  return {
    source: "GOOGLE_MAPS",
    externalId: String(id || `${place.dataId || place.placeId}:${text.slice(0, 40)}`).slice(0, 190),
    url: row.link || place.mapsUrl || "https://maps.google.com",
    title: `${stars}${place.label}`.trim(),
    content: text || place.label,
    authorName: row.user?.name,
    authorUrl: row.user?.link,
    publishedAt: parsePublishedAt(row.iso_date || row.iso_date_of_last_edit || row.date),
    kind: "review",
    rating,
    language: isArabicText(text) ? "ar" : undefined,
    raw: { ...row, place },
  };
}

export async function fetchSerpMaps(input: {
  engine: "google_maps" | "google_maps_reviews";
  params: Record<string, string>;
}) {
  const key = env("SERPAPI_API_KEY");
  if (!key) return {};
  const search = new URLSearchParams({ engine: input.engine, api_key: key, ...input.params });
  return getJson<Record<string, unknown>>(`https://serpapi.com/search.json?${search}`);
}

export async function resolveMapsPlace(input: {
  query: string;
  workspaceId?: string;
  projectId?: string;
  language?: string;
  country?: string;
}): Promise<{ place?: GoogleMapsPlace; skipped?: string }> {
  if (!hasSerpApi()) return { skipped: "SerpAPI key is missing" };
  const parsed = parseMapsPlaceInput(input.query);
  if (parsed.dataId || parsed.placeId) {
    return {
      place: {
        dataId: parsed.dataId,
        placeId: parsed.placeId,
        label: parsed.query,
        query: parsed.query,
        mapsUrl: parsed.mapsUrl,
      },
    };
  }
  const gate = await assertSerpCall({
    workspaceId: input.workspaceId,
    purpose: "live",
    keywordKey: `maps-resolve:${input.query}`,
  });
  if (!gate.allowed) return { skipped: gate.reason };
  const data = await fetchSerpMaps({
    engine: "google_maps",
    params: {
      q: parsed.query,
      hl: input.language === "ar" ? "ar" : "en",
      gl: (input.country || "eg").toLowerCase(),
      ll: CAIRO_MAPS_LL,
      type: "search",
    },
  });
  await recordSerpCall({
    workspaceId: input.workspaceId,
    purpose: "live",
    keywordKey: `maps-resolve:${input.query}`,
    engine: "google_maps",
  });
  const locals = [
    ...(((data.local_results as MapsLocal[]) ?? [])),
    ...((data.place_results ? [data.place_results as MapsLocal] : [])),
  ];
  const picked = pickCairoMapsPlace(locals, parsed.query);
  if (!picked?.data_id && !picked?.place_id) return { skipped: "No Google Maps place found" };
  return {
    place: {
      dataId: picked.data_id,
      placeId: picked.place_id,
      label: picked.title || parsed.query,
      query: parsed.query,
      mapsUrl: parsed.mapsUrl,
    },
  };
}

export async function fetchMapsReviews(input: {
  place: GoogleMapsPlace;
  workspaceId?: string;
  projectId?: string;
  intervalHours?: number;
  now?: Date;
}): Promise<{ mentions: RawMention[]; place: GoogleMapsPlace; skipped?: string }> {
  const place = input.place;
  if (!place.dataId && !place.placeId) return { mentions: [], place, skipped: "Place is missing a Maps id" };
  if (!hasSerpApi()) return { mentions: [], place, skipped: "SerpAPI key is missing" };
  if (!placeIsDue(place, input.intervalHours, input.now)) {
    return { mentions: [], place, skipped: "This place was already checked today" };
  }
  if (input.workspaceId) {
    const usage = await serpUsageSummary(input.workspaceId);
    if (serpBudgetLow(usage.remaining, usage.limit)) {
      return { mentions: [], place, skipped: "SerpAPI quota is low; Maps reviews wait until next month." };
    }
  }
  const key = `maps:${place.dataId || place.placeId}`.slice(0, 80);
  const gate = await assertSerpCall({
    workspaceId: input.workspaceId,
    purpose: "scheduled",
    keywordKey: key,
    units: 1,
  });
  if (!gate.allowed) return { mentions: [], place, skipped: gate.reason };
  const data = await fetchSerpMaps({
    engine: "google_maps_reviews",
    params: {
      ...(place.dataId ? { data_id: place.dataId } : { place_id: place.placeId ?? "" }),
      sort_by: "newest",
      hl: "en",
    },
  });
  await recordSerpCall({
    workspaceId: input.workspaceId,
    purpose: "scheduled",
    keywordKey: key,
    engine: "google_maps_reviews",
  });
  const rows = ((data.reviews as MapsReviewRow[]) ?? []).slice(0, 20);
  const mentions = rows
    .map((row) => mentionFromMapsReview(row, place))
    .filter((row): row is RawMention => Boolean(row));
  return {
    mentions,
    place: { ...place, lastFetchedAt: (input.now ?? new Date()).toISOString() },
  };
}
