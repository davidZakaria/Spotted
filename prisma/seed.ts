import { PrismaClient, Source } from "@prisma/client";
import { hash } from "bcryptjs";
import { ingestProject } from "../src/lib/jobs/ingest";
import { KEYLESS_DEFAULTS } from "../src/lib/connectors/registry";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@spotted.app";
  const passwordHash = await hash("demo1234", 12);
  await prisma.user.updateMany({
    where: { email: "demo@aether.app" },
    data: { email },
  });
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Dana Demo", passwordHash, locale: "en" },
  });

  let workspace = await prisma.workspace.findFirst({
    where: { members: { some: { userId: user.id } } },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Acme Labs",
        slug: "acme-labs",
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
  }

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
  });

  await prisma.connectorBudget.upsert({
    where: { workspaceId_source: { workspaceId: workspace.id, source: "X" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      source: "X",
      dailyCallLimit: 50,
      monthlyCallLimit: 500,
      monthlySpendLimitUsd: 25,
      costPerCallUsd: 0.005,
    },
  });

  let project = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, name: "Open source AI" },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "Open source AI",
        description: "Track conversation around open models, Next.js, and Arabic AI coverage.",
        workspaceId: workspace.id,
        config: {
          sources: KEYLESS_DEFAULTS,
          rssFeeds: ["https://news.ycombinator.com/rss"],
          redditSubreddits: ["MachineLearning", "programming"],
          competitors: ["openai"],
          languages: ["en", "ar"],
        },
        keywords: {
          create: [
            { phrase: "open source" },
            { phrase: "nextjs" },
            { phrase: "llama" },
            { phrase: "ذكاء اصطناعي" },
          ],
        },
      },
    });
  }

  const alert = await prisma.alert.findFirst({ where: { projectId: project.id, name: "Conversation spike" } });
  if (!alert) {
    await prisma.alert.create({
      data: {
        projectId: project.id,
        name: "Conversation spike",
        type: "SPIKE",
        spikeThreshold: 8,
        windowMinutes: 1440,
        channel: "EMAIL",
        emailTo: email,
      },
    });
  }

  let mock = await prisma.socialAccount.findFirst({
    where: { workspaceId: workspace.id, isMock: true, platform: "X" },
  });
  if (!mock) {
    mock = await prisma.socialAccount.create({
      data: {
        workspaceId: workspace.id,
        platform: Source.X,
        displayName: "Mock X account",
        handle: "spotted_demo",
        isMock: true,
        status: "mock",
      },
    });
  }

  const existingPost = await prisma.scheduledPost.findFirst({ where: { workspaceId: workspace.id } });
  if (!existingPost) {
    await prisma.scheduledPost.create({
      data: {
        workspaceId: workspace.id,
        accountId: mock.id,
        platforms: [Source.X],
        content: "Shipping this week: multilingual listening with Arabic RTL in the mention feed.",
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        createdById: user.id,
      },
    });
  }

  const existingInbox = await prisma.inboxItem.findFirst({ where: { workspaceId: workspace.id } });
  if (!existingInbox) {
    await prisma.inboxItem.create({
      data: {
        workspaceId: workspace.id,
        accountId: mock.id,
        platform: Source.X,
        externalId: "seed-inbox-1",
        type: "MENTION",
        authorName: "Samir",
        content: "تجربة رائعة مع المنصة — هل تدعمون العربية بالكامل؟",
        language: "ar",
        direction: "rtl",
        receivedAt: new Date(),
        status: "UNREAD",
      },
    });
  }

  console.log("Seeded demo user demo@spotted.app / demo1234");
  console.log("Ingesting live mentions (Reddit, HN, RSS, Google News, Bluesky, Mastodon, podcasts)…");
  try {
    const result = await ingestProject(project.id);
    console.log("Ingest result", result);
  } catch (error) {
    console.warn("Ingest during seed failed; use Listen now in the UI.", error);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
