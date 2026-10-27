import type { ProjectConfig } from "../src/lib/connectors/types";
import { prisma } from "../src/lib/db";
import { readBrandProfile, sentimentLexicon } from "../src/lib/listen/profile";
import { mentionSearchText } from "../src/lib/listen/query";
import { analyzeSentimentLocal } from "../src/lib/sentiment";

const BATCH = 100;

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, config: true } });
  const lexicons = new Map(
    projects.map((project) => [project.id, sentimentLexicon(readBrandProfile((project.config ?? {}) as ProjectConfig))]),
  );
  let lastId: string | undefined;
  let updated = 0;
  let complaints = 0;
  for (;;) {
    const rows = await prisma.mention.findMany({
      select: { id: true, projectId: true, title: true, content: true },
      take: BATCH,
      orderBy: { id: "asc" },
      ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const row of rows) {
      const result = analyzeSentimentLocal(mentionSearchText(row), lexicons.get(row.projectId));
      await prisma.mention.update({
        where: { id: row.id },
        data: {
          sentiment: result.sentiment,
          sentimentScore: result.sentimentScore,
          complaint: result.complaint,
        },
      });
      updated += 1;
      if (result.complaint) complaints += 1;
      lastId = row.id;
    }
    console.log(`rescored ${updated} mentions (${complaints} complaints & risk)`);
  }
  console.log(`Done. ${updated} mentions, ${complaints} marked Complaints & risk.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
