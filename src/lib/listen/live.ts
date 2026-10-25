import type { Source } from "@prisma/client";
import { getConnector } from "@/lib/connectors/registry";
import type { ProjectConfig, RawMention } from "@/lib/connectors/types";
import { persistMentions } from "@/lib/jobs/ingest";
import { analyzeSentiment } from "@/lib/sentiment";
import { detectLanguage } from "@/lib/language";
import { dedupeMentions, influenceScore } from "./dedupe";
import { mentionMatches, mentionSearchText, searchQueries, type KeywordRule } from "./query";
import { liveSourcePlan, type LiveSourceStatus } from "./sources";
import { serpUsageSummary } from "./serpapi";
import { searchQueryCap } from "./forum-serp";
import { isValidDate, parsePublishedAt, safeIso } from "./dates";
import { tokenOf } from "@/lib/crypto";

export type LiveHit = {
  source: Source;
  externalId: string;
  url: string;
  title?: string;
  content: string;
  authorName?: string;
  authorHandle?: string;
  publishedAt: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "UNKNOWN";
  complaint?: boolean;
  language?: string;
  influence: number;
  reach: number;
  kind?: string;
};

export type LiveProgress = {
  id: Source;
  name: string;
  nameAr: string;
  status: "waiting" | "searching" | "done" | "skipped";
  found: number;
  note?: string;
  noteAr?: string;
};

export async function searchOneSource(input: {
  source: Source;
  rule: KeywordRule;
  workspaceId: string;
  projectId: string;
  config: ProjectConfig;
  accessToken?: string;
  accountId?: string;
  accountExternalId?: string;
}): Promise<RawMention[]> {
  const connector = getConnector(input.source);
  if (!connector) return [];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const queries = searchQueries(input.rule, searchQueryCap(input.source));
  const out: RawMention[] = [];
  for (const query of queries) {
    const found = await connector.search({
      query,
      language: input.rule.language ?? undefined,
      country: input.rule.country ?? undefined,
      since,
      limit: 40,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      projectConfig: input.config,
      accessToken: tokenOf(input.accessToken),
      accountId: input.accountId,
      accountExternalId: input.accountExternalId,
      purpose: "live",
      keywordKey: input.rule.phrase,
    });
    out.push(...found);
  }
  return dedupeMentions(
    out.filter((mention) => {
      mention.publishedAt = parsePublishedAt(mention.publishedAt);
      if (isValidDate(mention.publishedAt) && mention.publishedAt < since) return false;
      return mentionMatches(mentionSearchText(mention), input.rule);
    }),
  );
}

export async function toLiveHit(mention: RawMention): Promise<LiveHit> {
  const text = mentionSearchText(mention);
  const sentiment = await analyzeSentiment(text);
  const language = detectLanguage(text);
  return {
    source: mention.source,
    externalId: String(mention.externalId),
    url: mention.url,
    title: mention.title,
    content: mention.content,
    authorName: mention.authorName,
    authorHandle: mention.authorHandle,
    publishedAt: safeIso(parsePublishedAt(mention.publishedAt)),
    sentiment: sentiment.sentiment,
    complaint: sentiment.complaint,
    language: language.language,
    influence: influenceScore(mention),
    reach: mention.reach ?? mention.viewCount ?? mention.followerCount ?? 0,
    kind: mention.kind,
  };
}

export async function runLiveSearch(input: {
  rule: KeywordRule;
  workspaceId: string;
  projectId: string;
  config: ProjectConfig;
  connected: { platform: Source; isMock: boolean; accessToken?: string | null; externalId?: string | null; id: string }[];
  persist?: boolean;
  keywordId?: string;
  onProgress?: (event: { type: "plan" | "source" | "hits" | "done"; plan?: LiveSourceStatus[]; progress?: LiveProgress; hits?: LiveHit[]; total?: number }) => Promise<void> | void;
}) {
  const serp = await serpUsageSummary(input.workspaceId);
  const plan = liveSourcePlan({
    connected: input.connected.filter((account) => !account.isMock).map((account) => account.platform),
    telegramChannels: input.config.telegramChannels,
    googleAlertFeeds: input.config.googleAlertFeeds,
    serpRemaining: serp.remaining,
    serpLimit: serp.limit,
  });
  await input.onProgress?.({ type: "plan", plan });
  const all: RawMention[] = [];
  for (const row of plan) {
    if (!row.ready) {
      await input.onProgress?.({
        type: "source",
        progress: {
          id: row.id,
          name: row.name,
          nameAr: row.nameAr,
          status: "skipped",
          found: 0,
          note: row.note,
          noteAr: row.noteAr,
        },
      });
      continue;
    }
    await input.onProgress?.({
      type: "source",
      progress: { id: row.id, name: row.name, nameAr: row.nameAr, status: "searching", found: 0 },
    });
    const account = input.connected.find((item) => item.platform === row.id && !item.isMock);
    try {
      const found = await searchOneSource({
        source: row.id,
        rule: input.rule,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        config: input.config,
        accessToken: tokenOf(account?.accessToken),
        accountId: account?.id,
        accountExternalId: account?.externalId ?? undefined,
      });
      const seen = new Set(all.map((mention) => `${mention.source}:${mention.externalId}`));
      const unique = dedupeMentions(found).filter((mention) => !seen.has(`${mention.source}:${mention.externalId}`));
      all.push(...unique);
      const hits = [];
      for (const mention of unique) {
        try {
          mention.publishedAt = parsePublishedAt(mention.publishedAt);
          hits.push(await toLiveHit(mention));
        } catch {
          // one bad mention must not fail the source
        }
      }
      await input.onProgress?.({
        type: "hits",
        progress: { id: row.id, name: row.name, nameAr: row.nameAr, status: "done", found: unique.length },
        hits,
      });
    } catch (error) {
      await input.onProgress?.({
        type: "source",
        progress: {
          id: row.id,
          name: row.name,
          nameAr: row.nameAr,
          status: "done",
          found: 0,
          note: error instanceof Error ? error.message : "Search failed",
        },
      });
    }
  }
  const unique = dedupeMentions(all);
  if (input.persist) {
    await persistMentions(
      input.projectId,
      unique.map((mention) => ({ mention, keywordId: input.keywordId })),
    );
  }
  await input.onProgress?.({ type: "done", total: unique.length });
  return unique;
}
