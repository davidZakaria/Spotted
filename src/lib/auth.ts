import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "./db";
import { appConfig } from "./config";
import { uniqueSlug } from "./utils";

const COOKIE = "aether_session";
const secret = () => new TextEncoder().encode(appConfig.authSecret);

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createSession(userId: string, workspaceId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const jwt = await new SignJWT({ userId, workspaceId, token })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
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
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  locale: string;
  workspaceId: string;
  workspaceName: string;
  role: Role;
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

export async function signupUser(input: {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
  locale?: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existing) throw new Error("An account with that email already exists");
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      locale: input.locale === "ar" ? "ar" : "en",
    },
  });
  const workspace = await prisma.workspace.create({
    data: {
      name: input.workspaceName,
      slug: uniqueSlug(input.workspaceName),
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
  return { user, workspace };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { memberships: true },
  });
  if (!user) throw new Error("Invalid email or password");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Invalid email or password");
  const workspaceId = user.memberships[0]?.workspaceId;
  if (!workspaceId) throw new Error("No workspace found for this user");
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
