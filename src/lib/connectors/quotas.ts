import { Source } from "@prisma/client";
import { prisma } from "../db";
import { warnProject } from "./usage";

export const IG_HASHTAG_LIMIT = 30;
export const IG_HASHTAG_WINDOW_DAYS = 7;

export async function instagramHashtagStatus(accountId?: string) {
  if (!accountId) {
    return { used: 0, remaining: IG_HASHTAG_LIMIT, hashtags: [] as string[], limited: false };
  }
  const since = new Date(Date.now() - IG_HASHTAG_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.hashtagQuotaUse.findMany({
    where: { accountId, source: "INSTAGRAM", usedAt: { gte: since } },
    select: { hashtag: true },
  });
  const hashtags = [...new Set(rows.map((r) => r.hashtag.toLowerCase()))];
  return {
    used: hashtags.length,
    remaining: Math.max(0, IG_HASHTAG_LIMIT - hashtags.length),
    hashtags,
    limited: hashtags.length >= IG_HASHTAG_LIMIT,
  };
}

export async function consumeInstagramHashtag(opts: {
  accountId?: string;
  hashtag: string;
  projectId?: string;
}) {
  const tag = opts.hashtag.replace(/^#/, "").toLowerCase();
  const status = await instagramHashtagStatus(opts.accountId);
  if (status.hashtags.includes(tag)) return { allowed: true, status };
  if (status.limited) {
    await warnProject(
      opts.projectId,
      "INSTAGRAM",
      "ig_hashtag_quota",
      `Instagram hashtag search is limited to ${IG_HASHTAG_LIMIT} unique hashtags per ${IG_HASHTAG_WINDOW_DAYS} days. "#${tag}" was skipped.`,
    );
    return { allowed: false, status };
  }
  if (opts.accountId) {
    await prisma.hashtagQuotaUse.create({
      data: { accountId: opts.accountId, source: Source.INSTAGRAM, hashtag: tag },
    });
  }
  return { allowed: true, status: { ...status, used: status.used + 1, remaining: status.remaining - 1 } };
}
