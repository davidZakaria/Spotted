import type { Source } from "@prisma/client";
import { prisma } from "../db";
import { detectLanguage } from "../language";
import { analyzeSentiment, extractTopics } from "../sentiment";
import { getConnector, KEYLESS_DEFAULTS } from "../connectors/registry";
import type { ProjectConfig, RawMention } from "../connectors/types";

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

export async function ingestProject(projectId: string) {
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
  const phrases = project.keywords.map((k) => k.phrase);
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
  for (const source of sources) {
    const connector = getConnector(source);
    if (!connector) continue;
    const accounts = liveAccounts.filter((account) => account.platform === source && !account.isMock);
    const passes = accounts.length ? accounts : [undefined];
    try {
      for (const account of passes) {
        for (const phrase of phrases.length ? phrases : [project.name]) {
          const keyword = project.keywords.find((k) => k.phrase === phrase);
          const ctx = {
            query: phrase,
            projectId: project.id,
            workspaceId: project.workspaceId,
            projectConfig: config,
            accessToken: account?.accessToken ?? undefined,
            accountId: account?.id,
            accountExternalId: account?.externalId ?? undefined,
            limit: 20,
          };
          const found = await connector.search(ctx);
          for (const mention of found) collected.push({ mention, keywordId: keyword?.id });
          if (connector.trackAccounts) {
            const tracked = await connector.trackAccounts(ctx);
            for (const mention of tracked) collected.push({ mention, keywordId: keyword?.id });
          }
        }
      }
    } catch (error) {
      await prisma.connectorWarning.create({
        data: {
          projectId: project.id,
          source,
          code: "ingest_error",
          message: error instanceof Error ? error.message : "Ingest failed",
        },
      });
    }
  }

  let upserted = 0;
  for (const row of collected) {
    const lang = detectLanguage(`${row.mention.title ?? ""} ${row.mention.content}`);
    const sentiment = await analyzeSentiment(`${row.mention.title ?? ""} ${row.mention.content}`);
    try {
      await prisma.mention.upsert({
        where: {
          projectId_source_externalId: {
            projectId: project.id,
            source: row.mention.source,
            externalId: String(row.mention.externalId).slice(0, 190),
          },
        },
        create: {
          projectId: project.id,
          keywordId: row.keywordId,
          source: row.mention.source,
          externalId: String(row.mention.externalId).slice(0, 190),
          url: row.mention.url || "https://example.invalid",
          title: row.mention.title,
          content: row.mention.content.slice(0, 8000),
          authorName: row.mention.authorName,
          authorHandle: row.mention.authorHandle,
          authorUrl: row.mention.authorUrl,
          publishedAt: row.mention.publishedAt,
          language: lang.language,
          direction: lang.direction,
          reach: row.mention.reach ?? 0,
          engagement: row.mention.engagement ?? 0,
          likeCount: row.mention.likeCount ?? 0,
          shareCount: row.mention.shareCount ?? 0,
          viewCount: row.mention.viewCount ?? 0,
          commentCount: row.mention.commentCount ?? 0,
          followerCount: row.mention.followerCount ?? 0,
          kind: row.mention.kind ?? "post",
          parentExternalId: row.mention.parentExternalId,
          sentiment: sentiment.sentiment,
          sentimentScore: sentiment.sentimentScore,
          topics: extractTopics([row.mention.content], 4).map((t) => t.topic),
          raw: row.mention.raw as object | undefined,
        },
        update: {
          content: row.mention.content.slice(0, 8000),
          reach: row.mention.reach ?? 0,
          engagement: row.mention.engagement ?? 0,
          likeCount: row.mention.likeCount ?? 0,
          shareCount: row.mention.shareCount ?? 0,
          viewCount: row.mention.viewCount ?? 0,
          commentCount: row.mention.commentCount ?? 0,
          sentiment: sentiment.sentiment,
          sentimentScore: sentiment.sentimentScore,
        },
      });
      upserted += 1;
    } catch {
      // unique races
    }
  }
  return { collected: collected.length, upserted };
}

export async function ingestAllActive() {
  const projects = await prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  const results = [];
  for (const p of projects) results.push(await ingestProject(p.id));
  return results;
}
