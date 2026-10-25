import { prisma } from "../src/lib/db";
import { mentionSearchText } from "../src/lib/listen/query";
import { analyzeSentimentLocal } from "../src/lib/sentiment";

const BATCH = 100;

async function main() {
  let lastId: string | undefined;
  let updated = 0;
  let complaints = 0;
  for (;;) {
    const rows = await prisma.mention.findMany({
      select: { id: true, title: true, content: true },
      take: BATCH,
      orderBy: { id: "asc" },
      ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const row of rows) {
      const result = analyzeSentimentLocal(mentionSearchText(row));
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
