import type { ProjectConfig } from "../src/lib/connectors/types";
import { prisma } from "../src/lib/db";
import { ruleFromKeyword } from "../src/lib/jobs/ingest";
import { mentionFailsNewRules, NJD_EXCLUDE_WORDS, NJD_PROJECT_IDS } from "../src/lib/listen/njd";

async function main() {
  let removed = 0;
  for (const projectId of NJD_PROJECT_IDS) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { keywords: true },
    });
    if (!project) {
      console.log(`Skip missing project ${projectId}`);
      continue;
    }
    const config = (project.config ?? {}) as ProjectConfig;
    const excludeWords = [...new Set([...(config.excludeWords ?? []), ...NJD_EXCLUDE_WORDS])];
    const keywords = project.keywords.map((keyword) => ruleFromKeyword(keyword));
    const mentions = await prisma.mention.findMany({
      where: { projectId },
      select: { id: true, source: true, title: true, content: true, url: true, authorHandle: true },
    });
    const ids = mentions
      .filter((mention) =>
        mentionFailsNewRules({
          source: mention.source,
          title: mention.title,
          content: mention.content,
          keywords,
          excludeWords,
        }),
      )
      .map((mention) => mention.id);
    if (ids.length) {
      const result = await prisma.mention.deleteMany({ where: { id: { in: ids } } });
      removed += result.count;
    }
    console.log(`${project.name}: removed ${ids.length} mention(s) that fail the new rules`);
  }
  console.log(`Done. Deleted ${removed} mention(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
