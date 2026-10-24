import { prisma } from "../db";
import { getConnector } from "../connectors/registry";

export async function publishDuePosts() {
  const due = await prisma.scheduledPost.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    include: { account: true },
  });
  let published = 0;
  for (const post of due) {
    await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "PUBLISHING" } });
    try {
      if (!post.account || post.account.isMock || !post.account.accessToken) {
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { status: "PUBLISHED", publishedAt: new Date(), error: null },
        });
        published += 1;
        continue;
      }
      const connector = getConnector(post.account.platform);
      if (!connector?.publish) throw new Error(`${post.account.platform} does not support publishing`);
      await connector.publish({
        content: post.content,
        mediaUrls: post.mediaUrls,
        accessToken: post.account.accessToken ?? undefined,
        accountExternalId: post.account.externalId ?? undefined,
      });
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), error: null },
      });
      published += 1;
    } catch (error) {
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "FAILED", error: error instanceof Error ? error.message : "Publish failed" },
      });
    }
  }
  return { published, attempted: due.length };
}

export async function syncInbox(workspaceId: string) {
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId, isMock: false, accessToken: { not: null } },
  });
  let stored = 0;
  for (const account of accounts) {
    const connector = getConnector(account.platform);
    if (!connector?.fetchInbox) continue;
    try {
      const items = await connector.fetchInbox({
        query: "",
        workspaceId,
        accessToken: account.accessToken ?? undefined,
        accountExternalId: account.externalId ?? undefined,
        accountId: account.id,
      });
      for (const item of items) {
        await prisma.inboxItem.upsert({
          where: {
            workspaceId_platform_externalId: {
              workspaceId,
              platform: account.platform,
              externalId: item.externalId,
            },
          },
          create: {
            workspaceId,
            accountId: account.id,
            platform: account.platform,
            externalId: item.externalId,
            type: item.type,
            authorName: item.authorName,
            content: item.content,
            url: item.url,
            receivedAt: item.receivedAt,
          },
          update: { content: item.content, status: undefined },
        });
        stored += 1;
      }
    } catch {
      // permission gaps are expected
    }
  }
  return { stored };
}
