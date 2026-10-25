import { prisma } from "@/lib/db";
import { env } from "@/lib/config";
import { getJson } from "@/lib/connectors/http";
import type { RawMention, Source } from "@/lib/connectors/types";
import { parsePublishedAt } from "./dates";

export const SERPAPI_SOURCE: Source = "WEB_SEARCH";
export const SERPAPI_SCHEDULED_PER_KEYWORD = 2;

export function serpMonthlyLimit(e: Record<string, string | undefined> = process.env) {
  const n = Number(e.SERPAPI_MONTHLY_LIMIT ?? 250);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 250;
}

export function hasSerpApi(e: Record<string, string | undefined> = process.env) {
  return Boolean(e.SERPAPI_API_KEY?.trim());
}

export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function dayStart(now = new Date()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function serpUsageSummary(workspaceId: string) {
  const limit = serpMonthlyLimit();
  const usedRow = await prisma.apiUsage.aggregate({
    where: {
      workspaceId,
      source: SERPAPI_SOURCE,
      endpoint: { startsWith: "serpapi." },
      createdAt: { gte: monthStart() },
    },
    _sum: { units: true },
  });
  const used = usedRow._sum.units ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used), hasKey: hasSerpApi() };
}

export async function assertSerpCall(input: {
  workspaceId?: string;
  purpose: "live" | "scheduled" | "backfill";
  keywordKey?: string;
  units?: number;
}): Promise<{ allowed: boolean; remaining: number; reason?: string; reasonAr?: string }> {
  if (!hasSerpApi()) {
    return { allowed: false, remaining: 0, reason: "SerpAPI key is missing", reasonAr: "مفتاح SerpAPI غير موجود" };
  }
  if (!input.workspaceId) return { allowed: true, remaining: serpMonthlyLimit() };
  const usage = await serpUsageSummary(input.workspaceId);
  const need = input.units ?? 1;
  if (usage.remaining < need) {
    return {
      allowed: false,
      remaining: usage.remaining,
      reason: `SerpAPI monthly limit reached (${usage.used}/${usage.limit}). Web search pauses until next month.`,
      reasonAr: `انتهى حد SerpAPI الشهري (${usage.used}/${usage.limit}).`,
    };
  }
  if (input.purpose === "scheduled") {
    const key = (input.keywordKey || "default").slice(0, 80);
    const today = await prisma.apiUsage.aggregate({
      where: {
        workspaceId: input.workspaceId,
        source: SERPAPI_SOURCE,
        endpoint: { startsWith: `serpapi.scheduled.${key}.` },
        createdAt: { gte: dayStart() },
      },
      _sum: { units: true },
    });
    if ((today._sum.units ?? 0) >= SERPAPI_SCHEDULED_PER_KEYWORD) {
      return {
        allowed: false,
        remaining: usage.remaining,
        reason: "This word already used its SerpAPI refreshes today. Live Search everywhere still works.",
        reasonAr: "هذه الكلمة استخدمت تحديث SerpAPI اليوم. البحث المباشر ما زال يعمل.",
      };
    }
  }
  return { allowed: true, remaining: usage.remaining };
}

export async function recordSerpCall(input: {
  workspaceId?: string;
  purpose: "live" | "scheduled" | "backfill";
  keywordKey?: string;
  engine: "google" | "google_news";
}) {
  if (!input.workspaceId) return;
  const key = (input.keywordKey || "default").slice(0, 80);
  const endpoint =
    input.purpose === "scheduled"
      ? `serpapi.scheduled.${key}.${input.engine}`
      : input.purpose === "backfill"
        ? `serpapi.backfill.${key}.${input.engine}`
        : `serpapi.live.${input.engine}`;
  await prisma.apiUsage.create({
    data: {
      workspaceId: input.workspaceId,
      source: SERPAPI_SOURCE,
      endpoint,
      units: 1,
      estimatedCostUsd: 0,
    },
  });
}

export type SerpOrganic = { title?: string; link?: string; snippet?: string; date?: string };
export type SerpNews = {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  source?: string | { name?: string };
};

export function newsSourceName(source: SerpNews["source"]): string | undefined {
  if (!source) return undefined;
  return typeof source === "string" ? source : source.name;
}

export function mentionsFromSerpPayload(
  data: { organic_results?: SerpOrganic[]; news_results?: SerpNews[]; error?: string },
  input: { engine: "google" | "google_news"; query: string; source: Source; fetchedAt?: Date },
): RawMention[] {
  if (data.error) throw new Error(data.error);
  const fetchedAt = input.fetchedAt ?? new Date();
  const rows = input.engine === "google_news" ? data.news_results ?? [] : data.organic_results ?? [];
  const out: RawMention[] = [];
  rows.forEach((row, index) => {
    try {
      const link = "link" in row ? row.link : undefined;
      const title = row.title;
      if (!link && !title) return;
      out.push({
        source: input.source,
        externalId: link || `serp:${input.engine}:${input.query}:${index}`,
        url: link || "",
        title,
        content: row.snippet ?? title ?? "",
        authorName: input.engine === "google_news" ? newsSourceName((row as SerpNews).source) : undefined,
        publishedAt: parsePublishedAt(row.date, fetchedAt),
        kind: input.engine === "google_news" ? "article" : "web",
        raw: { ...row, date: row.date ?? null },
      });
    } catch {
      // one bad SerpAPI row must not fail the source
    }
  });
  return out;
}

export async function fetchSerpResults(input: {
  query: string;
  engine: "google" | "google_news";
  language?: string;
  country?: string;
  limit?: number;
  source: Source;
}): Promise<RawMention[]> {
  const key = env("SERPAPI_API_KEY");
  if (!key) return [];
  const hl = input.language === "ar" ? "ar" : "en";
  const gl = (input.country || (input.language === "ar" ? "eg" : "us")).toLowerCase();
  const data = await getJson<{
    organic_results?: SerpOrganic[];
    news_results?: SerpNews[];
    error?: string;
  }>(
    `https://serpapi.com/search.json?${new URLSearchParams({
      engine: input.engine,
      q: input.query,
      api_key: key,
      hl,
      gl,
      num: String(Math.min(Math.max(input.limit ?? 10, 1), 100)),
    })}`,
  );
  return mentionsFromSerpPayload(data, {
    engine: input.engine,
    query: input.query,
    source: input.source,
  });
}

export async function runSerpSearch(input: {
  query: string;
  engine: "google" | "google_news";
  purpose: "live" | "scheduled" | "backfill";
  workspaceId?: string;
  projectId?: string;
  keywordKey?: string;
  language?: string;
  country?: string;
  source: Source;
  limit?: number;
}): Promise<{ mentions: RawMention[]; skipped?: string; skippedAr?: string; remaining: number }> {
  const gate = await assertSerpCall({
    workspaceId: input.workspaceId,
    purpose: input.purpose,
    keywordKey: input.keywordKey,
  });
  if (!gate.allowed) {
    return { mentions: [], skipped: gate.reason, skippedAr: gate.reasonAr, remaining: gate.remaining };
  }
  const mentions = await fetchSerpResults({
    query: input.query,
    engine: input.engine,
    language: input.language,
    country: input.country,
    source: input.source,
    limit: input.limit,
  });
  await recordSerpCall({
    workspaceId: input.workspaceId,
    purpose: input.purpose,
    keywordKey: input.keywordKey,
    engine: input.engine,
  });
  const after = input.workspaceId ? await serpUsageSummary(input.workspaceId) : { remaining: gate.remaining - 1 };
  return { mentions, remaining: after.remaining };
}
