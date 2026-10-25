import { appConfig, env } from "../config";
import { getJson } from "./http";
import { assertBudget, recordUsage, warnProject } from "./usage";
import { hasSerpApi, runSerpSearch } from "../listen/serpapi";
import type { Connector, ConnectorContext, RawMention, Source } from "./types";

type BraveResult = {
  web?: { results?: { title: string; url: string; description?: string; age?: string }[] };
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

async function runProvider(source: Source, query: string, ctx: ConnectorContext, site?: string) {
  const q = site ? `${query} site:${site}` : query;
  const workspaceBudget = await assertBudget(ctx.workspaceId, source);
  if (!workspaceBudget.allowed) {
    await warnProject(ctx.projectId, source, "budget", workspaceBudget.reason ?? "budget");
    return [];
  }

  const purpose = ctx.purpose ?? "scheduled";
  if (hasSerpApi() && !site) {
    const serp = await runSerpSearch({
      query: q,
      engine: "google",
      purpose,
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      keywordKey: ctx.keywordKey,
      language: ctx.language,
      country: ctx.country,
      source,
    });
    if (serp.mentions.length) {
      await recordUsage({ workspaceId: ctx.workspaceId, source, endpoint: "serpapi.google" });
      return serp.mentions;
    }
    if (serp.skipped) {
      await warnProject(ctx.projectId, source, "serpapi_budget", serp.skipped);
    }
  }

  if (env("BRAVE_SEARCH_API_KEY")) {
    const items = await braveSearch(q, 10);
    await recordUsage({ workspaceId: ctx.workspaceId, source, endpoint: "brave.search" });
    return items.map((item) => ({ ...item, source }));
  }

  return [];
}

export const webSearchConnector: Connector = {
  id: "WEB_SEARCH",
  name: "Web search",
  family: "Search",
  docsUrl: "https://serpapi.com/search-api",
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
  docsUrl: "https://serpapi.com/search-api",
  keyless: false,
  capabilities: [],
  isConfigured: () => Boolean(env("BRAVE_SEARCH_API_KEY")),
  async search(ctx) {
    if (!env("BRAVE_SEARCH_API_KEY")) return [];
    return runProvider("QUORA", ctx.query, ctx, "quora.com");
  },
};

void appConfig;
