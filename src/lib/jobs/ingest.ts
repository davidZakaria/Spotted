import type { Keyword, Source } from "@prisma/client";
import { prisma } from "../db";
import { isValidDate, parsePublishedAt } from "../listen/dates";
import { tokenOf } from "../crypto";
import { detectLanguage } from "../language";
import { analyzeSentiment, extractTopics } from "../sentiment";
import { getConnector, KEYLESS_DEFAULTS } from "../connectors/registry";
import type { ProjectConfig, RawMention } from "../connectors/types";
import { mentionMatches, mentionSearchText, ruleFromPhrase, searchQueries, type KeywordRule } from "../listen/query";
import { searchQueryCap } from "../listen/forum-serp";
import { dedupeMentions } from "../listen/dedupe";
import {
  BACKFILL_DAYS,
  BACKFILL_SOURCES,
  arabicTerms,
  backfillSerpQuery,
  INGEST_DAYS,
  lookbackSince,
  markHistoryScan,
  wantsArabicCoverage,
} from "../listen/backfill";
import { hasSerpApi, runSerpSearch } from "../listen/serpapi";

export function mergeConnectedSources(
  sources: Source[],
  accounts: { platform: Source; isMock: boolean; externalId?: string | null }[],
): Source[] {
  const next = [...sources];
  for (const platform of ["FACEBOOK", "INSTAGRAM"] as Source[]) {
    const linked = accounts.some((account) => account.platform === platform && !account.isMock && account.externalId);
    if (linked && !next.includes(platform)) next.push(platform);
  }
  return next;
}

export function pageIdsFromAccounts(
  existing: string[] | undefined,
  accounts: { platform: Source; isMock: boolean; externalId?: string | null }[],
  platform: Source,
) {
  return [
    ...new Set([
      ...(existing ?? []),
      ...accounts.filter((account) => account.platform === platform && !account.isMock && account.externalId).map((account) => String(account.externalId)),
    ]),
  ];
}

export function ruleFromKeyword(keyword: Pick<Keyword, "phrase" | "matchType" | "language" | "country" | "requiredWords" | "excludedWords" | "booleanQuery" | "synonyms" | "autoVariants">): KeywordRule {
  return ruleFromPhrase(keyword.phrase, {
    matchType: keyword.matchType,
    language: keyword.language,
    country: keyword.country,
    requiredWords: keyword.requiredWords,
    excludedWords: keyword.excludedWords,
    booleanQuery: keyword.booleanQuery,
    synonyms: keyword.synonyms,
    autoVariants: keyword.autoVariants,
  });
}

export async function persistMentions(
  projectId: string,
  rows: { mention: RawMention; keywordId?: string }[],
) {
  const unique = dedupeMentions(rows.map((row) => row.mention));
  const byKey = new Map(unique.map((mention) => [`${mention.source}:${mention.externalId}`, mention]));
  let upserted = 0;
  for (const row of rows) {
    const mention = byKey.get(`${row.mention.source}:${row.mention.externalId}`);
    if (!mention) continue;
    byKey.delete(`${row.mention.source}:${row.mention.externalId}`);
    const searchText = mentionSearchText(mention);
    const lang = detectLanguage(searchText);
    const sentiment = await analyzeSentiment(searchText);
    try {
      await prisma.mention.upsert({
        where: {
          projectId_source_externalId: {
            projectId,
            source: mention.source,
            externalId: String(mention.externalId).slice(0, 190),
          },
        },
        create: {
          projectId,
          keywordId: row.keywordId,
          source: mention.source,
          externalId: String(mention.externalId).slice(0, 190),
          url: mention.url || "https://example.invalid",
          title: mention.title,
          content: mention.content.slice(0, 8000),
          authorName: mention.authorName,
          authorHandle: mention.authorHandle,
          authorUrl: mention.authorUrl,
          publishedAt: parsePublishedAt(mention.publishedAt),
          language: lang.language,
          direction: lang.direction,
          reach: mention.reach ?? 0,
          engagement: mention.engagement ?? 0,
          likeCount: mention.likeCount ?? 0,
          shareCount: mention.shareCount ?? 0,
          viewCount: mention.viewCount ?? 0,
          commentCount: mention.commentCount ?? 0,
          followerCount: mention.followerCount ?? 0,
          kind: mention.kind ?? "post",
          parentExternalId: mention.parentExternalId,
          sentiment: sentiment.sentiment,
          sentimentScore: sentiment.sentimentScore,
          complaint: sentiment.complaint,
          topics: extractTopics([mention.content], 4).map((topic) => topic.topic),
          raw: mention.raw as object | undefined,
        },
        update: {
          content: mention.content.slice(0, 8000),
          keywordId: row.keywordId,
          publishedAt: parsePublishedAt(mention.publishedAt),
          reach: mention.reach ?? 0,
          engagement: mention.engagement ?? 0,
          likeCount: mention.likeCount ?? 0,
          shareCount: mention.shareCount ?? 0,
          viewCount: mention.viewCount ?? 0,
          commentCount: mention.commentCount ?? 0,
          sentiment: sentiment.sentiment,
          sentimentScore: sentiment.sentimentScore,
          complaint: sentiment.complaint,
          language: lang.language,
        },
      });
      upserted += 1;
    } catch {
      // unique races
    }
  }
  return { collected: rows.length, upserted };
}

type KeywordRow = {
  keyword?: Keyword;
  rule: KeywordRule;
  queries: string[];
};

async function collectFromSources(input: {
  projectId: string;
  workspaceId: string;
  config: ProjectConfig;
  liveAccounts: { id: string; platform: Source; isMock: boolean; accessToken?: string | null; externalId?: string | null }[];
  sources: Source[];
  rows: KeywordRow[];
  since: Date;
  purpose: "scheduled" | "backfill";
  history?: boolean;
  includeTrackAccounts?: boolean;
  preferEgyptNews?: boolean;
  extraQueries?: string[];
}) {
  const collected: { mention: RawMention; keywordId?: string }[] = [];
  for (const source of input.sources) {
    const connector = getConnector(source);
    if (!connector) continue;
    const accounts = input.liveAccounts.filter((account) => account.platform === source && !account.isMock);
    const passes = accounts.length ? accounts : [undefined];
    try {
      for (const account of passes) {
        for (const { keyword, rule, queries } of input.rows) {
          const searchTerms = queries.slice(0, searchQueryCap(source));
          for (const [index, query] of searchTerms.entries()) {
            const ctx = {
              query,
              language: rule.language ?? undefined,
              country: rule.country ?? undefined,
              since: input.since,
              projectId: input.projectId,
              workspaceId: input.workspaceId,
              projectConfig: input.config,
              accessToken: tokenOf(account?.accessToken),
              accountId: account?.id,
              accountExternalId: account?.externalId ?? undefined,
              limit: input.purpose === "backfill" ? 50 : 40,
              purpose: input.purpose,
              keywordKey: keyword?.id ?? rule.phrase,
              preferEgyptNews: input.preferEgyptNews,
              extraQueries: source === "GOOGLE_NEWS" && index === 0 ? input.extraQueries : undefined,
            };
            const found = await connector.search(ctx);
            for (const mention of found) {
              if (!mentionMatches(mentionSearchText(mention), rule)) continue;
              mention.publishedAt = parsePublishedAt(mention.publishedAt);
              if (isValidDate(mention.publishedAt) && mention.publishedAt < input.since) continue;
              collected.push({
                mention: input.history ? markHistoryScan(mention) : mention,
                keywordId: keyword?.id,
              });
            }
            if (input.includeTrackAccounts && connector.trackAccounts) {
              const tracked = await connector.trackAccounts(ctx);
              for (const mention of tracked) {
                if (!mentionMatches(mentionSearchText(mention), rule)) continue;
                collected.push({ mention, keywordId: keyword?.id });
              }
            }
          }
        }
      }
    } catch (error) {
      await prisma.connectorWarning.create({
        data: {
          projectId: input.projectId,
          source,
          code: "ingest_error",
          message: error instanceof Error ? error.message : "Ingest failed",
        },
      });
    }
  }
  return collected;
}

async function collectBackfillSerp(input: {
  projectId: string;
  workspaceId: string;
  row: KeywordRow;
  since: Date;
  languages?: string[];
  timezone?: string | null;
}) {
  if (!hasSerpApi()) return [] as { mention: RawMention; keywordId?: string }[];
  const planned = backfillSerpQuery(input.row.rule, {
    languages: input.languages,
    timezone: input.timezone,
  });
  const serp = await runSerpSearch({
    query: planned.query,
    engine: "google",
    purpose: "backfill",
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    keywordKey: input.row.keyword?.id ?? input.row.rule.phrase,
    language: planned.language,
    country: planned.country,
    source: "WEB_SEARCH",
    limit: 100,
  });
  const out: { mention: RawMention; keywordId?: string }[] = [];
  for (const mention of serp.mentions) {
    if (!mentionMatches(mentionSearchText(mention), input.row.rule)) continue;
    mention.publishedAt = parsePublishedAt(mention.publishedAt);
    if (isValidDate(mention.publishedAt) && mention.publishedAt < input.since) continue;
    out.push({ mention: markHistoryScan(mention), keywordId: input.row.keyword?.id });
  }
  return out;
}

async function markKeywordBackfilled(keywordId: string) {
  await prisma.keyword.update({ where: { id: keywordId }, data: { backfilledAt: new Date() } });
}

export async function ingestProject(
  projectId: string,
  opts: { forceBackfill?: boolean; keywordId?: string } = {},
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { keywords: true, entities: true, workspace: { include: { accounts: true } } },
  });
  if (!project) throw new Error("Project not found");
  const config = (project.config ?? {}) as ProjectConfig;
  const liveAccounts = project.workspace.accounts;
  const sources = mergeConnectedSources(
    (config.sources?.length ? config.sources : KEYLESS_DEFAULTS) as Source[],
    liveAccounts,
  );
  config.instagramUserIds = pageIdsFromAccounts(config.instagramUserIds, liveAccounts, "INSTAGRAM");
  if (project.entities.length) {
    config.competitors = [
      ...(config.competitors ?? []),
      ...project.entities.filter((e) => e.isCompetitor).map((e) => e.handle),
    ];
    config.facebookPageIds = [
      ...(config.facebookPageIds ?? []),
      ...project.entities.filter((e) => e.source === "FACEBOOK").map((e) => e.externalId),
    ];
    config.youtubeChannelIds = [
      ...(config.youtubeChannelIds ?? []),
      ...project.entities.filter((e) => e.source === "YOUTUBE").map((e) => e.externalId),
    ];
    config.redditSubreddits = [
      ...(config.redditSubreddits ?? []),
      ...project.entities.filter((e) => e.source === "REDDIT").map((e) => e.handle),
    ];
    config.telegramChannels = [
      ...(config.telegramChannels ?? []),
      ...project.entities.filter((e) => e.source === "TELEGRAM").map((e) => e.handle),
    ];
    config.appStoreIds = [
      ...(config.appStoreIds ?? []),
      ...project.entities.filter((e) => e.source === "APP_STORE").map((e) => e.externalId),
    ];
  }

  const collected: { mention: RawMention; keywordId?: string }[] = [];
  const regularSince = lookbackSince(INGEST_DAYS);
  const backfillSince = lookbackSince(BACKFILL_DAYS);
  const keywordRules: KeywordRow[] = project.keywords.length
    ? project.keywords.map((keyword) => ({
        keyword,
        rule: ruleFromKeyword(keyword),
        queries: searchQueries(ruleFromKeyword(keyword)),
      }))
    : [{ keyword: undefined, rule: ruleFromPhrase(project.name), queries: searchQueries(ruleFromPhrase(project.name)) }];
  const targeted = opts.keywordId
    ? keywordRules.filter((row) => row.keyword?.id === opts.keywordId)
    : keywordRules;
  const shared = {
    projectId: project.id,
    workspaceId: project.workspaceId,
    config,
    liveAccounts,
  };

  for (const row of targeted) {
    const needsBackfill = Boolean(
      opts.forceBackfill ||
        (row.keyword ? !row.keyword.backfilledAt : !config.backfilledAt),
    );
    if (needsBackfill) {
      const arabic = wantsArabicCoverage(row.rule, {
        languages: config.languages,
        timezone: project.workspace.timezone,
      });
      collected.push(
        ...(await collectFromSources({
          ...shared,
          sources: BACKFILL_SOURCES,
          rows: [row],
          since: backfillSince,
          purpose: "backfill",
          history: true,
          includeTrackAccounts: false,
          preferEgyptNews: arabic,
          extraQueries: arabic ? arabicTerms(row.rule) : [],
        })),
        ...(await collectBackfillSerp({
          projectId: project.id,
          workspaceId: project.workspaceId,
          row,
          since: backfillSince,
          languages: config.languages,
          timezone: project.workspace.timezone,
        })),
      );
      if (row.keyword) {
        await markKeywordBackfilled(row.keyword.id);
      } else {
        await prisma.project.update({
          where: { id: project.id },
          data: { config: { ...config, backfilledAt: new Date().toISOString() } },
        });
        config.backfilledAt = new Date().toISOString();
      }
    } else {
      collected.push(
        ...(await collectFromSources({
          ...shared,
          sources,
          rows: [row],
          since: regularSince,
          purpose: "scheduled",
          includeTrackAccounts: true,
        })),
      );
    }
  }

  return persistMentions(project.id, collected);
}

export async function ingestAllActive() {
  const projects = await prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  const results = [];
  for (const p of projects) results.push(await ingestProject(p.id));
  return results;
}
