import { prisma } from "./db";
import type { SessionUser } from "./auth";

export class AuthzError extends Error {
  status: number;
  constructor(message = "Not found", status = 404) {
    super(message);
    this.name = "AuthzError";
    this.status = status;
  }
}

export function assertSameWorkspace(sessionWorkspaceId: string, resourceWorkspaceId: string | null | undefined) {
  if (!resourceWorkspaceId || sessionWorkspaceId !== resourceWorkspaceId) {
    throw new AuthzError("Not found");
  }
}

export async function requireApiSession(): Promise<SessionUser> {
  const { getSession } = await import("./auth");
  const session = await getSession();
  if (!session) throw new AuthzError("Sign in first", 401);
  return session;
}

export async function projectInWorkspace(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
  });
  if (!project) throw new AuthzError("Brand not found");
  return project;
}

export async function accountInWorkspace(workspaceId: string, accountId: string) {
  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, workspaceId },
  });
  if (!account) throw new AuthzError("Account not found");
  return account;
}

export async function reportInWorkspace(workspaceId: string, reportId: string) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, workspaceId },
  });
  if (!report) throw new AuthzError("Report not found");
  return report;
}

export async function inboxInWorkspace(workspaceId: string, itemId: string) {
  const item = await prisma.inboxItem.findFirst({
    where: { id: itemId, workspaceId },
    include: { account: true },
  });
  if (!item) throw new AuthzError("Inbox item not found");
  return item;
}

export function workspaceScope(session: SessionUser) {
  return { workspaceId: session.workspaceId };
}
