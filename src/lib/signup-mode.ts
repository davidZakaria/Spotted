import { env } from "./config";
import { prisma } from "./db";

export type SignupMode = "closed" | "invite" | "open";

export function signupModeFrom(input: { envMode?: string | null; ownerExists: boolean }): SignupMode {
  const raw = (input.envMode ?? "").trim().toLowerCase();
  if (raw === "closed" || raw === "invite" || raw === "open") return raw;
  return input.ownerExists ? "closed" : "open";
}

export async function ownerExists() {
  const owner = await prisma.membership.findFirst({ where: { role: "OWNER" }, select: { id: true } });
  return Boolean(owner);
}

export async function resolveSignupMode(): Promise<SignupMode> {
  return signupModeFrom({ envMode: env("SIGNUP_MODE"), ownerExists: await ownerExists() });
}
