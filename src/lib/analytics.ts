import { Prisma, type Source } from "@prisma/client";
import { prisma } from "./db";
import { extractTopics } from "./sentiment";

export async function projectAnalytics(projectId: string, days = 7) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const mentions = await prisma.mention.findMany({
    where: { projectId, publishedAt: { gte: from } },
    orderBy: { publishedAt: "asc" },
  });

  const byDay = new Map<string, { volume: number; reach: number; positive: number; negative: number; neutral: number }>();
  const authors = new Map<string, { name: string; count: number; reach: number }>();
  const sources = new Map<Source, number>();
  const keywordShare = new Map<string, number>();

  for (const m of mentions) {
    const day = m.publishedAt.toISOString().slice(0, 10);
    const row = byDay.get(day) ?? { volume: 0, reach: 0, positive: 0, negative: 0, neutral: 0 };
    row.volume += 1;
    row.reach += m.reach || m.viewCount || m.followerCount || 0;
    if (m.sentiment === "POSITIVE") row.positive += 1;
    else if (m.sentiment === "NEGATIVE") row.negative += 1;
    else row.neutral += 1;
    byDay.set(day, row);
    sources.set(m.source, (sources.get(m.source) ?? 0) + 1);
    if (m.authorName || m.authorHandle) {
      const key = m.authorHandle || m.authorName || "unknown";
      const a = authors.get(key) ?? { name: m.authorName || key, count: 0, reach: 0 };
      a.count += 1;
      a.reach += m.reach || 0;
      authors.set(key, a);
    }
    if (m.keywordId) keywordShare.set(m.keywordId, (keywordShare.get(m.keywordId) ?? 0) + 1);
  }

  const keywords = await prisma.keyword.findMany({ where: { projectId } });
  const shareOfVoice = keywords.map((k) => ({
    phrase: k.phrase,
    count: keywordShare.get(k.id) ?? 0,
    share: mentions.length ? (keywordShare.get(k.id) ?? 0) / mentions.length : 0,
  }));

  const sourceShare = [...sources.entries()].map(([source, count]) => ({
    source,
    count,
    share: mentions.length ? count / mentions.length : 0,
  }));

  const sentiment = {
    positive: mentions.filter((m) => m.sentiment === "POSITIVE").length,
    neutral: mentions.filter((m) => m.sentiment === "NEUTRAL" || m.sentiment === "UNKNOWN").length,
    negative: mentions.filter((m) => m.sentiment === "NEGATIVE").length,
  };

  return {
    totals: {
      volume: mentions.length,
      reach: mentions.reduce((a, m) => a + (m.reach || m.viewCount || m.followerCount || 0), 0),
      engagement: mentions.reduce((a, m) => a + (m.engagement || m.likeCount + m.shareCount + m.commentCount), 0),
      authors: authors.size,
    },
    sentiment,
    series: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    topAuthors: [...authors.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    shareOfVoice,
    sourceShare,
    topics: extractTopics(mentions.map((m) => `${m.title ?? ""} ${m.content}`), 10),
    languages: Object.entries(
      mentions.reduce<Record<string, number>>((acc, m) => {
        const lang = m.language || "und";
        acc[lang] = (acc[lang] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([language, count]) => ({ language, count })),
  };
}

export async function workspaceOverview(workspaceId: string) {
  const [projects, mentions, alerts, posts] = await Promise.all([
    prisma.project.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.mention.count({
      where: { project: { workspaceId }, publishedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    }),
    prisma.alert.count({ where: { project: { workspaceId }, enabled: true } }),
    prisma.scheduledPost.count({ where: { workspaceId, status: "SCHEDULED" } }),
  ]);
  const recent = await prisma.mention.findMany({
    where: { project: { workspaceId } },
    orderBy: { publishedAt: "desc" },
    take: 6,
    include: { project: true },
  });
  return { projects, mentions, alerts, posts, recent };
}

void Prisma;
