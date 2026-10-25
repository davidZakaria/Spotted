import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { prisma } from "../src/lib/db";
import { hashPassword, validatePassword } from "../src/lib/password";
import { uniqueSlug } from "../src/lib/utils";
import { writeAudit } from "../src/lib/audit";

async function readPassword() {
  if (process.env.OWNER_PASSWORD?.trim()) return process.env.OWNER_PASSWORD.trim();
  if (!input.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of input) chunks.push(Buffer.from(chunk));
    const fromStdin = Buffer.concat(chunks).toString("utf8").trim();
    if (fromStdin) return fromStdin;
    throw new Error("Set OWNER_PASSWORD or pipe the password on stdin");
  }
  const rl = createInterface({ input, output });
  const password = await rl.question("Owner password: ");
  rl.close();
  return password.trim();
}

async function main() {
  const email = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.OWNER_NAME ?? "Owner").trim() || "Owner";
  const workspaceName = (process.env.OWNER_WORKSPACE ?? "Spotted").trim() || "Spotted";
  if (!email || !email.includes("@")) {
    throw new Error("Set OWNER_EMAIL to the owner login");
  }
  const existingOwner = await prisma.membership.findFirst({ where: { role: "OWNER" } });
  if (existingOwner && process.env.FORCE_OWNER !== "true") {
    throw new Error("An owner already exists. Set FORCE_OWNER=true to add another.");
  }
  const password = await readPassword();
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error(`User ${email} already exists`);

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, locale: "en" },
  });
  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      slug: uniqueSlug(workspaceName),
      onboardedAt: new Date(),
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await prisma.connectorBudget.create({
    data: {
      workspaceId: workspace.id,
      source: "X",
      dailyCallLimit: 50,
      monthlyCallLimit: 500,
      monthlySpendLimitUsd: 25,
      costPerCallUsd: 0.005,
    },
  });
  await writeAudit({ action: "owner.create", userId: user.id, workspaceId: workspace.id, metadata: { email } });
  console.log(`Created owner ${email} in workspace ${workspace.name} (${workspace.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
