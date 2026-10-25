import { prisma } from "@/lib/db";
import { env } from "@/lib/config";
import { getJson } from "@/lib/connectors/http";
import type { RawMention, Source } from "@/lib/connectors/types";

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
  purpose: "live" | "scheduled";
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
  purpose: "live" | "scheduled";
  keywordKey?: string;
  engine: "google" | "google_news";
}) {
  if (!input.workspaceId) return;
  const key = (input.keywordKey || "default").slice(0, 80);
  const endpoint =
    input.purpose === "scheduled" ? `serpapi.scheduled.${key}.${input.engine}` : `serpapi.live.${input.engine}`;
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

type SerpOrganic = { title?: string; link?: string; snippet?: string; date?: string };
type SerpNews = { title?: string; link?: string; snippet?: string; date?: string; source?: { name?: string } };

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
      num: String(Math.min(input.limit ?? 10, 10)),
    })}`,
  );
  if (data.error) throw new Error(data.error);
  const rows = input.engine === "google_news" ? data.news_results ?? [] : data.organic_results ?? [];
  return rows.map((row, index) => ({
    source: input.source,
    externalId: row.link || `serp:${input.engine}:${input.query}:${index}`,
    url: row.link || "",
    title: row.title,
    content: row.snippet ?? row.title ?? "",
    authorName: input.engine === "google_news" ? (row as SerpNews).source?.name : undefined,
    publishedAt: row.date ? new Date(row.date) : new Date(),
    kind: input.engine === "google_news" ? "article" : "web",
    raw: row,
  }));
}

export async function runSerpSearch(input: {
  query: string;
  engine: "google" | "google_news";
  purpose: "live" | "scheduled";
  workspaceId?: string;
  projectId?: string;
  keywordKey?: string;
  language?: string;
  country?: string;
  source: Source;
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
