"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Source, type AlertChannel, type AlertType, type Role } from "@prisma/client";
import { prisma } from "./db";
import { canAdmin, canEdit, requireSession } from "./auth";
import { parseCsvList, uniqueSlug } from "./utils";
import { ingestProject } from "./jobs/ingest";
import { enqueue } from "./queue";
import { KEYLESS_DEFAULTS } from "./connectors/registry";
import { buildCsvReport, buildPdfReport } from "./reports";
import { evaluateAlerts } from "./jobs/alerts";

export async function createProjectAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const phrases = parseCsvList(String(formData.get("keywords") ?? ""));
  const sources = formData
    .getAll("sources")
    .map(String)
    .filter((s): s is Source => Object.values(Source).includes(s as Source));
  if (!name) throw new Error("Name is required");
  const project = await prisma.project.create({
    data: {
      name,
      description,
      workspaceId: session.workspaceId,
      config: {
        sources: sources.length ? sources : KEYLESS_DEFAULTS,
        rssFeeds: parseCsvList(String(formData.get("rssFeeds") ?? "")),
        googleAlertFeeds: parseCsvList(String(formData.get("googleAlertFeeds") ?? "")),
        telegramChannels: parseCsvList(String(formData.get("telegramChannels") ?? "")),
        facebookPageIds: parseCsvList(String(formData.get("facebookPageIds") ?? "")),
        instagramHashtags: parseCsvList(String(formData.get("instagramHashtags") ?? "")),
        redditSubreddits: parseCsvList(String(formData.get("redditSubreddits") ?? "")),
        youtubeChannelIds: parseCsvList(String(formData.get("youtubeChannelIds") ?? "")),
        appStoreIds: parseCsvList(String(formData.get("appStoreIds") ?? "")),
        competitors: parseCsvList(String(formData.get("competitors") ?? "")),
        webSearchProvider: "brave",
      },
      keywords: { create: phrases.map((phrase) => ({ phrase })) },
    },
  });
  const queued = await enqueue("ingest-project", { projectId: project.id });
  if (!queued) await ingestProject(project.id);
  revalidatePath("/app");
  redirect(`/app/projects/${project.id}`);
}

export async function listenNowAction(projectId: string) {
  const session = await requireSession();
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: session.workspaceId },
  });
  if (!project) throw new Error("Project not found");
  const queued = await enqueue("ingest-project", { projectId });
  if (!queued) await ingestProject(projectId);
  await evaluateAlerts(projectId);
  revalidatePath(`/app/projects/${projectId}`);
}

export async function createAlertAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const projectId = String(formData.get("projectId"));
  await prisma.alert.create({
    data: {
      projectId,
      name: String(formData.get("name") ?? "Alert"),
      type: String(formData.get("type") ?? "SPIKE") as AlertType,
      keyword: String(formData.get("keyword") ?? "") || null,
      spikeThreshold: Number(formData.get("spikeThreshold") ?? 15),
      windowMinutes: Number(formData.get("windowMinutes") ?? 60),
      channel: String(formData.get("channel") ?? "EMAIL") as AlertChannel,
      emailTo: String(formData.get("emailTo") ?? session.email),
      slackWebhook: String(formData.get("slackWebhook") ?? "") || null,
    },
  });
  revalidatePath(`/app/projects/${projectId}/alerts`);
}

export async function schedulePostAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("Write something to publish");
  const when = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = when ? new Date(when) : new Date(Date.now() + 60 * 60 * 1000);
  let accountId = String(formData.get("accountId") ?? "") || null;
  if (!accountId) {
    const existing = await prisma.socialAccount.findFirst({
      where: { workspaceId: session.workspaceId, isMock: true, platform: "X" },
    });
    const mock =
      existing ??
      (await prisma.socialAccount.create({
        data: {
          workspaceId: session.workspaceId,
          platform: "X",
          displayName: "Mock X account",
          handle: "aether_demo",
          isMock: true,
          status: "mock",
        },
      }));
    accountId = mock.id;
  }
  await prisma.scheduledPost.create({
    data: {
      workspaceId: session.workspaceId,
      accountId,
      platforms: ["X"],
      content,
      scheduledAt,
      createdById: session.id,
    },
  });
  revalidatePath("/app/publish");
}

export async function inviteMemberAction(formData: FormData) {
  const session = await requireSession();
  if (!canAdmin(session.role)) throw new Error("Admin only");
  const email = String(formData.get("email") ?? "").toLowerCase();
  const role = String(formData.get("role") ?? "VIEWER") as Role;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("That user must sign up first");
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: session.workspaceId } },
    update: { role },
    create: { userId: user.id, workspaceId: session.workspaceId, role },
  });
  revalidatePath("/app/settings/members");
}

export async function createWorkspaceAction(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug: uniqueSlug(name),
      members: { create: { userId: session.id, role: "OWNER" } },
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
  revalidatePath("/app");
}

export async function updateBudgetAction(formData: FormData) {
  const session = await requireSession();
  if (!canAdmin(session.role)) throw new Error("Admin only");
  await prisma.connectorBudget.upsert({
    where: {
      workspaceId_source: { workspaceId: session.workspaceId, source: "X" },
    },
    update: {
      dailyCallLimit: Number(formData.get("dailyCallLimit") ?? 50),
      monthlyCallLimit: Number(formData.get("monthlyCallLimit") ?? 500),
      monthlySpendLimitUsd: Number(formData.get("monthlySpendLimitUsd") ?? 25),
    },
    create: {
      workspaceId: session.workspaceId,
      source: "X",
      dailyCallLimit: Number(formData.get("dailyCallLimit") ?? 50),
      monthlyCallLimit: Number(formData.get("monthlyCallLimit") ?? 500),
      monthlySpendLimitUsd: Number(formData.get("monthlySpendLimitUsd") ?? 25),
      costPerCallUsd: 0.005,
    },
  });
  revalidatePath("/app/settings/sources");
}

export async function generateReportAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId"));
  const format = String(formData.get("format") ?? "CSV") as "CSV" | "PDF";
  const from = new Date(String(formData.get("from") ?? new Date(Date.now() - 7 * 86400000).toISOString()));
  const to = new Date(String(formData.get("to") ?? new Date().toISOString()));
  const filePath = format === "PDF" ? await buildPdfReport(projectId, from, to) : await buildCsvReport(projectId, from, to);
  await prisma.report.create({
    data: {
      workspaceId: session.workspaceId,
      projectId,
      name: `${format} report`,
      format,
      from,
      to,
      filePath,
    },
  });
  revalidatePath("/app/reports");
}

export async function replyInboxAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  const message = String(formData.get("message") ?? "");
  const item = await prisma.inboxItem.findFirst({
    where: { id, workspaceId: session.workspaceId },
    include: { account: true },
  });
  if (!item) throw new Error("Inbox item not found");
  await prisma.inboxItem.update({ where: { id }, data: { status: "REPLIED" } });
  if (item.account && !item.account.isMock && item.account.accessToken) {
    const { getConnector } = await import("./connectors/registry");
    const connector = getConnector(item.platform);
    await connector?.reply?.({
      query: "",
      accessToken: item.account.accessToken,
      accountExternalId: item.account.externalId ?? undefined,
      externalId: item.externalId,
      message,
    });
  }
  revalidatePath("/app/inbox");
}

export async function setLocaleAction(locale: "en" | "ar") {
  const session = await requireSession();
  await prisma.user.update({ where: { id: session.id }, data: { locale } });
  revalidatePath("/app");
}
