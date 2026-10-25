import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "./db";
import { appConfig } from "./config";
import { uniqueSlug } from "./utils";
import { hashPassword, verifyPassword, assertPassword } from "./password";
import { resolveSignupMode } from "./signup-mode";
import { openSecret } from "./crypto";
import { verifyTotp } from "./totp";

const COOKIE = "spotted_session";
const PENDING_2FA = "spotted_2fa";
const secret = () => new TextEncoder().encode(appConfig.authSecret);

export class NeedsTotpError extends Error {
  userId: string;
  constructor(userId: string) {
    super("Two-factor code required");
    this.name = "NeedsTotpError";
    this.userId = userId;
  }
}

export async function createSession(userId: string, workspaceId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + appConfig.sessionDays * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const jwt = await new SignJWT({ userId, workspaceId, token })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${appConfig.sessionDays}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
  jar.delete(PENDING_2FA);
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    try {
      const { payload } = await jwtVerify(raw, secret());
      if (typeof payload.token === "string") {
        await prisma.session.deleteMany({ where: { token: payload.token } });
      }
    } catch {
      // ignore
    }
  }
  jar.delete(COOKIE);
  jar.delete(PENDING_2FA);
}

export async function destroyAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(PENDING_2FA);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  locale: string;
  workspaceId: string;
  workspaceName: string;
  role: Role;
  totpEnabled: boolean;
};

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secret());
    const userId = String(payload.userId ?? "");
    const workspaceId = String(payload.workspaceId ?? "");
    const token = String(payload.token ?? "");
    if (!userId || !workspaceId || !token) return null;
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            memberships: { include: { workspace: true } },
          },
        },
      },
    });
    if (!session || session.expiresAt < new Date()) return null;
    if (session.user.disabled) return null;
    const membership =
      session.user.memberships.find((m) => m.workspaceId === workspaceId) ??
      session.user.memberships[0];
    if (!membership) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      locale: session.user.locale,
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspace.name,
      role: membership.role,
      totpEnabled: session.user.totpEnabled,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function canEdit(role: Role) {
  return role === "OWNER" || role === "ADMIN" || role === "EDITOR";
}

export function canAdmin(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

async function loadInvite(token: string) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error("That invite is missing or expired");
  }
  return invite;
}

export async function acceptInviteForUser(userId: string, token: string) {
  const invite = await loadInvite(token);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Account not found");
  if (user.email !== invite.email) throw new Error("This invite was sent to a different email");
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId, workspaceId: invite.workspaceId } },
    update: { role: invite.role },
    create: { userId, workspaceId: invite.workspaceId, role: invite.role },
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  await createSession(userId, invite.workspaceId);
  return invite;
}

export async function signupUser(input: {
  name: string;
  email: string;
  password: string;
  workspaceName?: string;
  locale?: string;
  invite?: string;
}) {
  const email = input.email.toLowerCase();
  const mode = await resolveSignupMode();
  const inviteToken = input.invite?.trim();
  if (mode === "closed" && !inviteToken) throw new Error("Sign-up is closed. Ask an owner for an invite.");
  if (mode === "invite" && !inviteToken) throw new Error("An invite is required to create an account.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with that email already exists");
  const passwordHash = await hashPassword(input.password);

  if (inviteToken) {
    const invite = await loadInvite(inviteToken);
    if (invite.email !== email) throw new Error("This invite was sent to a different email");
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
        locale: input.locale === "ar" ? "ar" : "en",
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role },
    });
    await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    await createSession(user.id, invite.workspaceId);
    return { user, workspaceId: invite.workspaceId, invited: true as const };
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash,
      locale: input.locale === "ar" ? "ar" : "en",
    },
  });
  const workspace = await prisma.workspace.create({
    data: {
      name: input.workspaceName?.trim() || "My brand",
      slug: uniqueSlug(input.workspaceName?.trim() || "workspace"),
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
  await createSession(user.id, workspace.id);
  return { user, workspace, invited: false as const };
}

async function recordFailedLogin(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
  });
  if (user.failedLoginCount >= appConfig.loginMaxAttempts) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: new Date(Date.now() + appConfig.loginLockoutMinutes * 60 * 1000),
        failedLoginCount: 0,
      },
    });
    return "locked" as const;
  }
  return "failed" as const;
}

async function assertNotLocked(user: { lockedUntil: Date | null; disabled: boolean }) {
  if (user.disabled) throw new Error("This account is disabled");
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error("This account is locked. Try again later.");
  }
}

export async function loginUser(email: string, password: string, totp?: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { memberships: true },
  });
  if (!user) throw new Error("Invalid email or password");
  await assertNotLocked(user);
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const result = await recordFailedLogin(user.id);
    if (result === "locked") throw new Error("Too many failed sign-ins. Try again later.");
    throw new Error("Invalid email or password");
  }
  if (user.totpEnabled) {
    if (!totp) throw new NeedsTotpError(user.id);
    const secretValue = openSecret(user.totpSecret);
    if (!secretValue || !verifyTotp(secretValue, totp)) {
      const result = await recordFailedLogin(user.id);
      if (result === "locked") throw new Error("Too many failed sign-ins. Try again later.");
      throw new Error("Invalid authentication code");
    }
  }
  const workspaceId = user.memberships[0]?.workspaceId;
  if (!workspaceId) throw new Error("No workspace found for this user");
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id, workspaceId);
  return user;
}

export async function setPendingTotp(userId: string) {
  const jwt = await new SignJWT({ userId, purpose: "totp" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(secret());
  const jar = await cookies();
  jar.set(PENDING_2FA, jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 5 * 60,
  });
}

export async function completeTotpLogin(code: string) {
  const jar = await cookies();
  const raw = jar.get(PENDING_2FA)?.value;
  if (!raw) throw new Error("Sign in again, then enter the code");
  const { payload } = await jwtVerify(raw, secret());
  if (payload.purpose !== "totp" || typeof payload.userId !== "string") {
    throw new Error("Sign in again, then enter the code");
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { memberships: true },
  });
  if (!user) throw new Error("Invalid authentication code");
  await assertNotLocked(user);
  const secretValue = openSecret(user.totpSecret);
  if (!secretValue || !verifyTotp(secretValue, code)) {
    const result = await recordFailedLogin(user.id);
    if (result === "locked") throw new Error("Too many failed sign-ins. Try again later.");
    throw new Error("Invalid authentication code");
  }
  const workspaceId = user.memberships[0]?.workspaceId;
  if (!workspaceId) throw new Error("No workspace found for this user");
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id, workspaceId);
  return user;
}

export async function switchWorkspace(userId: string, workspaceId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) throw new Error("Not a member of that workspace");
  await createSession(userId, workspaceId);
}

export { assertPassword, hashPassword, verifyPassword };
