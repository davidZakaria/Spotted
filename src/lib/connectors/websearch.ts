import { appConfig, env } from "../config";
import { getJson } from "./http";
import { assertBudget, recordUsage, warnProject } from "./usage";
import type { Connector, RawMention, Source } from "./types";

type BraveResult = {
  web?: { results?: { title: string; url: string; description?: string; age?: string }[] };
};

type SerpResult = {
  organic_results?: { title: string; link: string; snippet?: string; date?: string }[];
};

async function braveSearch(query: string, limit: number): Promise<RawMention[]> {
  const key = env("BRAVE_SEARCH_API_KEY");
  if (!key) return [];
  const data = await getJson<BraveResult>(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`,
    { headers: { "X-Subscription-Token": key, Accept: "application/json" } },
  );
  return (data.web?.results ?? []).map((r, i) => ({
    source: "WEB_SEARCH" as const,
    externalId: r.url || `brave:${query}:${i}`,
    url: r.url,
    title: r.title,
    content: r.description ?? "",
    publishedAt: r.age ? new Date(r.age) : new Date(),
    kind: "article",
    raw: r,
  }));
}

async function serpSearch(query: string, limit: number): Promise<RawMention[]> {
  const key = env("SERPAPI_API_KEY");
  if (!key) return [];
  const data = await getJson<SerpResult>(
    `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${key}&num=${limit}`,
  );
  return (data.organic_results ?? []).map((r, i) => ({
    source: "WEB_SEARCH" as const,
    externalId: r.link || `serp:${query}:${i}`,
    url: r.link,
    title: r.title,
    content: r.snippet ?? "",
    publishedAt: r.date ? new Date(r.date) : new Date(),
    kind: "article",
    raw: r,
  }));
}

async function runProvider(source: Source, query: string, ctx: { workspaceId?: string; projectId?: string; projectConfig?: { webSearchProvider?: string } }, site?: string) {
  const provider = ctx.projectConfig?.webSearchProvider || appConfig.webSearchProvider;
  const q = site ? `${query} site:${site}` : query;
  const budget = await assertBudget(ctx.workspaceId, source);
  if (!budget.allowed) {
    await warnProject(ctx.projectId, source, "budget", budget.reason ?? "budget");
    return [];
  }
  const items = provider === "serpapi" ? await serpSearch(q, 10) : await braveSearch(q, 10);
  if (provider === "brave" && !env("BRAVE_SEARCH_API_KEY") && env("SERPAPI_API_KEY")) {
    const fallback = await serpSearch(q, 10);
    await recordUsage({ workspaceId: ctx.workspaceId, source, endpoint: "serpapi.fallback" });
    return fallback.map((m) => ({ ...m, source }));
  }
  await recordUsage({ workspaceId: ctx.workspaceId, source, endpoint: `${provider}.search` });
  return items.map((m) => ({ ...m, source }));
}

export const webSearchConnector: Connector = {
  id: "WEB_SEARCH",
  name: "Web search",
  family: "Search",
  docsUrl: "https://api.search.brave.com/app/documentation/web-search/get-started",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("BRAVE_SEARCH_API_KEY") || env("SERPAPI_API_KEY")),
  async search(ctx) {
    return runProvider("WEB_SEARCH", ctx.query, ctx);
  },
};

export const quoraConnector: Connector = {
  id: "QUORA",
  name: "Quora / forums",
  family: "Search",
  docsUrl: "https://api.search.brave.com/app/documentation/web-search/get-started",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("BRAVE_SEARCH_API_KEY") || env("SERPAPI_API_KEY")),
  async search(ctx) {
    return runProvider("QUORA", ctx.query, ctx, "quora.com");
  },
};
