import { prisma } from "./db";
import { redactSecrets } from "./crypto";

export type AuditAction =
  | "login.success"
  | "login.failure"
  | "login.lockout"
  | "logout"
  | "logout.all"
  | "signup"
  | "invite.create"
  | "invite.accept"
  | "oauth.connect"
  | "oauth.disconnect"
  | "owner.create"
  | "password.change"
  | "totp.enable"
  | "totp.disable"
  | "demo.disable"
  | "tokens.encrypt";

export async function writeAudit(input: {
  action: AuditAction | string;
  userId?: string | null;
  workspaceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId ?? undefined,
        workspaceId: input.workspaceId ?? undefined,
        ip: input.ip ?? undefined,
        userAgent: input.userAgent ?? undefined,
        metadata: input.metadata ? (redactSecrets(input.metadata) as never) : undefined,
      },
    });
  } catch (error) {
    console.error("[audit] write failed", error instanceof Error ? error.message : "unknown");
  }
}
