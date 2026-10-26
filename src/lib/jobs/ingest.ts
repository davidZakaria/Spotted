import type { Keyword, Source } from "@prisma/client";
import { prisma } from "../db";
import { isValidDate, parsePublishedAt } from "../listen/dates";
import { tokenOf } from "../crypto";
import { detectLanguage } from "../language";
import { analyzeSentiment, extractTopics } from "../sentiment";
import { getConnector, KEYLESS_DEFAULTS } from "../connectors/registry";
import type { ProjectConfig, RawMention } from "../connectors/types";
import { containsAnyWord, keepMention, mentionSearchText, ruleFromPhrase, searchQueries, type KeywordRule } from "../listen/query";
import { searchQueryCap } from "../listen/forum-serp";
import { dedupeMentions } from "../listen/dedupe";
import {
  BACKFILL_DAYS,
  BACKFILL_SOURCES,
  backfillSerpQuery,
  INGEST_DAYS,
  lookbackSince,
  markHistoryScan,
  wantsArabicCoverage,
} from "../listen/backfill";
import { hasSerpApi, runSerpSearch } from "../listen/serpapi";
import {
  appendSerpExcludes,
  FREE_SPLIT_QUERY_CAP,
  selectSerpSynonyms,
  sourceUsesPackedSerpQuery,
  synonymRotationSlot,
} from "../listen/synonyms";
import { applyReviewSentiment, fetchMapsReviews, mapsIntervalHours } from "../listen/maps";
import type { GoogleMapsPlace } from "../connectors/types";

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

export function ruleFromKeyword(keyword: Pick<Keyword, "phrase" | "matchType" | "language" | "country" | "requiredWords" | "excludedWords" | "booleanQuery" | "synonyms" | "requiredAny" | "requiredAnyWhen" | "autoVariants">): KeywordRule {
  return ruleFromPhrase(keyword.phrase, {
    matchType: keyword.matchType,
    language: keyword.language,
    country: keyword.country,
    requiredWords: keyword.requiredWords,
    excludedWords: keyword.excludedWords,
    booleanQuery: keyword.booleanQuery,
    synonyms: keyword.synonyms,
    requiredAny: keyword.requiredAny,
    requiredAnyWhen: keyword.requiredAnyWhen,
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
    const sentiment = applyReviewSentiment(await analyzeSentiment(searchText), mention.rating);
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
          rating: mention.rating,
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
          rating: mention.rating,
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
  serpQuery: string;
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
        for (const { keyword, rule, queries, serpQuery } of input.rows) {
          const searchTerms = sourceUsesPackedSerpQuery(source)
            ? [serpQuery]
            : queries.slice(0, searchQueryCap(source));
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
              serpQuery,
              skipSerp: index > 0,
            };
            const found = await connector.search(ctx);
            const excludes = input.config.excludeWords ?? [];
            for (const mention of found) {
              if (!keepMention(mentionSearchText(mention), rule, excludes)) continue;
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
                if (!keepMention(mentionSearchText(mention), rule, excludes)) continue;
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
  excludeWords?: string[];
}) {
  if (!hasSerpApi()) return [] as { mention: RawMention; keywordId?: string }[];
  const planned = backfillSerpQuery(input.row.rule, {
    languages: input.languages,
    timezone: input.timezone,
    rotateLeftovers: false,
  });
  const serp = await runSerpSearch({
    query: appendSerpExcludes(planned.query, [...(input.row.rule.excludedWords ?? []), ...(input.excludeWords ?? [])]),
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
    if (!keepMention(mentionSearchText(mention), input.row.rule, input.excludeWords ?? [])) continue;
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
    ? project.keywords.map((keyword) => {
        const rule = ruleFromKeyword(keyword);
        return {
          keyword,
          rule,
          queries: searchQueries(rule, FREE_SPLIT_QUERY_CAP),
          serpQuery: appendSerpExcludes(
            selectSerpSynonyms(rule, {
              rotation: synonymRotationSlot(keyword.id),
              rotateLeftovers: true,
              preferArabic: wantsArabicCoverage(rule, {
                languages: config.languages,
                timezone: project.workspace.timezone,
              }),
            }).query,
            [...(rule.excludedWords ?? []), ...(config.excludeWords ?? [])],
          ),
        };
      })
    : [
        {
          keyword: undefined,
          rule: ruleFromPhrase(project.name),
          queries: searchQueries(ruleFromPhrase(project.name), FREE_SPLIT_QUERY_CAP),
          serpQuery: appendSerpExcludes(
            selectSerpSynonyms(ruleFromPhrase(project.name)).query,
            config.excludeWords,
          ),
        },
      ];
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
        })),
        ...(await collectBackfillSerp({
          projectId: project.id,
          workspaceId: project.workspaceId,
          row,
          since: backfillSince,
          languages: config.languages,
          timezone: project.workspace.timezone,
          excludeWords: config.excludeWords,
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

  if (!opts.keywordId) {
    collected.push(
      ...(await collectMapsReviews({
        projectId: project.id,
        workspaceId: project.workspaceId,
        config,
      })),
    );
  }

  return persistMentions(project.id, collected);
}

async function collectMapsReviews(input: {
  projectId: string;
  workspaceId: string;
  config: ProjectConfig;
}) {
  const places = input.config.googleMapsPlaces ?? [];
  if (!places.length) return [] as { mention: RawMention; keywordId?: string }[];
  const interval = mapsIntervalHours(input.config.googleMapsIntervalHours);
  const nextPlaces: GoogleMapsPlace[] = [];
  const out: { mention: RawMention; keywordId?: string }[] = [];
  const excludes = input.config.excludeWords ?? [];
  for (const place of places) {
    try {
      const result = await fetchMapsReviews({
        place,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        intervalHours: interval,
      });
      nextPlaces.push(result.place);
      const expectedSkip =
        !result.skipped ||
        /already checked today|quota is low|key is missing/i.test(result.skipped);
      if (result.skipped && !expectedSkip) {
        await prisma.connectorWarning.create({
          data: {
            projectId: input.projectId,
            source: "GOOGLE_MAPS",
            code: "maps_skip",
            message: result.skipped,
          },
        });
      }
      for (const mention of result.mentions) {
        if (containsAnyWord(mentionSearchText(mention), excludes)) continue;
        out.push({ mention });
      }
    } catch (error) {
      nextPlaces.push(place);
      await prisma.connectorWarning.create({
        data: {
          projectId: input.projectId,
          source: "GOOGLE_MAPS",
          code: "maps_error",
          message: error instanceof Error ? error.message : "Maps reviews failed",
        },
      });
    }
  }
  if (JSON.stringify(nextPlaces) !== JSON.stringify(places)) {
    await prisma.project.update({
      where: { id: input.projectId },
      data: { config: { ...input.config, googleMapsPlaces: nextPlaces } },
    });
    input.config.googleMapsPlaces = nextPlaces;
  }
  return out;
}

export async function ingestAllActive() {
  const projects = await prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  const results = [];
  for (const p of projects) results.push(await ingestProject(p.id));
  return results;
}
