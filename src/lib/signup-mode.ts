import { env } from "./config";
import { prisma } from "./db";

export type SignupMode = "closed" | "invite" | "open";

export const DEMO_EMAILS = ["demo@spotted.app", "demo@aether.app"] as const;

export function isDemoEmail(email: string) {
  return DEMO_EMAILS.includes(email.trim().toLowerCase() as (typeof DEMO_EMAILS)[number]);
}

/** Demo and disabled users do not count as a blocking owner for first-install CLIs. */
export function countsAsBlockingOwner(user: { email: string; disabled?: boolean | null }) {
  if (user.disabled) return false;
  return !isDemoEmail(user.email);
}

export function realOwnerWhere() {
  return {
    role: "OWNER" as const,
    user: {
      disabled: false,
      email: { notIn: [...DEMO_EMAILS] },
    },
  };
}

export function signupModeFrom(input: { envMode?: string | null; ownerExists: boolean }): SignupMode {
  const raw = (input.envMode ?? "").trim().toLowerCase();
  if (raw === "closed" || raw === "invite" || raw === "open") return raw;
  return input.ownerExists ? "closed" : "open";
}

export async function ownerExists() {
  const owner = await prisma.membership.findFirst({
    where: realOwnerWhere(),
    select: { id: true },
  });
  return Boolean(owner);
}

export async function resolveSignupMode(): Promise<SignupMode> {
  return signupModeFrom({ envMode: env("SIGNUP_MODE"), ownerExists: await ownerExists() });
}
