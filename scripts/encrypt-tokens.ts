import { encryptStoredTokens } from "../src/lib/encrypt-tokens";
import { prisma } from "../src/lib/db";
import { writeAudit } from "../src/lib/audit";

async function main() {
  const result = await encryptStoredTokens();
  await writeAudit({ action: "tokens.encrypt", metadata: result });
  console.log(`Scanned ${result.scanned} row(s), encrypted ${result.updated}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
