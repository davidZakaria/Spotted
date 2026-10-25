import { prisma } from "../src/lib/db";
import { writeAudit } from "../src/lib/audit";
import { DEMO_EMAILS } from "../src/lib/signup-mode";

const DEMO_EMAIL = DEMO_EMAILS[0];

async function main() {
  const del = process.argv.includes("--delete") || process.env.DEMO_ACTION === "delete";
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    console.log(`No ${DEMO_EMAIL} user found.`);
    return;
  }
  await prisma.session.deleteMany({ where: { userId: user.id } });
  if (del) {
    await prisma.user.delete({ where: { id: user.id } });
    await writeAudit({ action: "demo.disable", metadata: { email: DEMO_EMAIL, deleted: true } });
    console.log(`Deleted ${DEMO_EMAIL} and related sessions.`);
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { disabled: true, totpEnabled: false, totpSecret: null, failedLoginCount: 0, lockedUntil: null },
  });
  await writeAudit({ action: "demo.disable", userId: user.id, metadata: { email: DEMO_EMAIL, deleted: false } });
  console.log(`Disabled ${DEMO_EMAIL}. Sign-in is blocked. Use --delete to remove the user.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
