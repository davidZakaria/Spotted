"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Source, type AlertChannel, type AlertType, type MatchType, type Role } from "@prisma/client";
import { prisma } from "./db";
import {
  assertPassword,
  canAdmin,
  canEdit,
  destroyAllSessions,
  hashPassword,
  requireSession,
  verifyPassword,
} from "./auth";
import { accountInWorkspace, inboxInWorkspace, projectInWorkspace } from "./authz";
import { inviteSchema } from "./validation";
import { writeAudit } from "./audit";
import { sendMail } from "./mail";
import { requestMeta } from "./request-meta";
import { absoluteUrl } from "./urls";
import { generateTotpSecret, verifyTotp } from "./totp";
import { openSecret, sealSecret } from "./crypto";
import { parseCsvList, uniqueSlug } from "./utils";
import { ingestProject } from "./jobs/ingest";
import { syncInbox } from "./jobs/publish";
import { enqueue } from "./queue";
import { KEYLESS_DEFAULTS } from "./connectors/registry";
import { buildCsvReport, buildPdfReport } from "./reports";
import { evaluateAlerts } from "./jobs/alerts";
import { csvWords } from "./listen/query";
import { mapsIntervalHours, resolveMapsPlace } from "./listen/maps";
import type { GoogleMapsPlace, ProjectConfig } from "./connectors/types";

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

export async function keepWatchingAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const projectId = String(formData.get("projectId") ?? "");
  const phrase = String(formData.get("phrase") ?? "").trim();
  if (!projectId || !phrase) throw new Error("Add a word to watch");
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: session.workspaceId },
  });
  if (!project) throw new Error("Brand not found");
  const data = {
    matchType: (String(formData.get("matchType") ?? "CONTAINS") as MatchType) || "CONTAINS",
    language: String(formData.get("language") ?? "") || null,
    country: String(formData.get("country") ?? "") || null,
    requiredWords: csvWords(String(formData.get("required") ?? "")),
    excludedWords: csvWords(String(formData.get("excluded") ?? "")),
    booleanQuery: String(formData.get("boolean") ?? "") || null,
    synonyms: csvWords(String(formData.get("synonyms") ?? "")),
    requiredAny: csvWords(String(formData.get("requiredAny") ?? "")),
    requiredAnyWhen: csvWords(String(formData.get("requiredAnyWhen") ?? "")),
    autoVariants: formData.get("autoVariants") !== "off",
  };
  const existing = await prisma.keyword.findFirst({ where: { projectId, phrase } });
  if (existing) {
    await prisma.keyword.update({ where: { id: existing.id }, data });
  } else {
    await prisma.keyword.create({ data: { projectId, phrase, ...data } });
  }
  const queued = await enqueue("ingest-project", { projectId });
  if (!queued) await ingestProject(projectId);
  revalidatePath("/app/mentions");
  revalidatePath("/app/analytics");
  revalidatePath(`/app/projects/${projectId}`);
}

export async function searchPastYearAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const projectId = String(formData.get("projectId") ?? "");
  const keywordId = String(formData.get("keywordId") ?? "") || undefined;
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: session.workspaceId },
  });
  if (!project) throw new Error("Project not found");
  const payload = { projectId, forceBackfill: "1", ...(keywordId ? { keywordId } : {}) };
  const queued = await enqueue("ingest-project", payload);
  if (!queued) await ingestProject(projectId, { forceBackfill: true, keywordId });
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/mentions");
  revalidatePath("/app/analytics");
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
  revalidatePath("/app");
  revalidatePath("/app/mentions");
  revalidatePath("/app/analytics");
}

async function loadProjectConfig(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
  if (!project) throw new Error("Brand not found");
  return { project, config: (project.config ?? {}) as ProjectConfig };
}

export async function saveIgnoreWordsAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const projectId = String(formData.get("projectId") ?? "");
  await projectInWorkspace(session.workspaceId, projectId);
  const { project, config } = await loadProjectConfig(session.workspaceId, projectId);
  await prisma.project.update({
    where: { id: project.id },
    data: { config: { ...config, excludeWords: csvWords(String(formData.get("excludeWords") ?? "")) } },
  });
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/mentions");
}

export async function saveKeywordContextAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const projectId = String(formData.get("projectId") ?? "");
  const keywordId = String(formData.get("keywordId") ?? "");
  await projectInWorkspace(session.workspaceId, projectId);
  const keyword = await prisma.keyword.findFirst({ where: { id: keywordId, projectId } });
  if (!keyword) throw new Error("Watched word not found");
  await prisma.keyword.update({
    where: { id: keyword.id },
    data: {
      requiredAny: csvWords(String(formData.get("requiredAny") ?? "")),
      requiredAnyWhen: csvWords(String(formData.get("requiredAnyWhen") ?? "")),
    },
  });
  revalidatePath(`/app/projects/${projectId}`);
}

export async function addGoogleMapsPlaceAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const projectId = String(formData.get("projectId") ?? "");
  const raw = String(formData.get("place") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  if (!raw) throw new Error("Paste a Google Maps link or the name of the place");
  await projectInWorkspace(session.workspaceId, projectId);
  const { project, config } = await loadProjectConfig(session.workspaceId, projectId);
  const resolved = await resolveMapsPlace({
    query: raw,
    workspaceId: session.workspaceId,
    projectId,
    country: "eg",
  });
  if (!resolved.place) throw new Error(resolved.skipped || "We could not find that place");
  const place: GoogleMapsPlace = {
    ...resolved.place,
    label: label || resolved.place.label || raw,
    query: raw,
  };
  const existing = config.googleMapsPlaces ?? [];
  const key = place.dataId || place.placeId || place.label;
  const next = existing.filter((item) => (item.dataId || item.placeId || item.label) !== key);
  next.push(place);
  await prisma.project.update({
    where: { id: project.id },
    data: { config: { ...config, googleMapsPlaces: next } },
  });
  revalidatePath(`/app/projects/${projectId}`);
}

export async function removeGoogleMapsPlaceAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const projectId = String(formData.get("projectId") ?? "");
  const key = String(formData.get("placeKey") ?? "");
  await projectInWorkspace(session.workspaceId, projectId);
  const { project, config } = await loadProjectConfig(session.workspaceId, projectId);
  await prisma.project.update({
    where: { id: project.id },
    data: {
      config: {
        ...config,
        googleMapsPlaces: (config.googleMapsPlaces ?? []).filter(
          (item) => (item.dataId || item.placeId || item.label) !== key,
        ),
      },
    },
  });
  revalidatePath(`/app/projects/${projectId}`);
}

export async function saveMapsIntervalAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const projectId = String(formData.get("projectId") ?? "");
  await projectInWorkspace(session.workspaceId, projectId);
  const { project, config } = await loadProjectConfig(session.workspaceId, projectId);
  await prisma.project.update({
    where: { id: project.id },
    data: {
      config: {
        ...config,
        googleMapsIntervalHours: mapsIntervalHours(Number(formData.get("hours") ?? 24)),
      },
    },
  });
  revalidatePath(`/app/projects/${projectId}`);
}

export async function createAlertAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const projectId = String(formData.get("projectId"));
  await projectInWorkspace(session.workspaceId, projectId);
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
  revalidatePath("/app/alerts");
}

export async function schedulePostAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("Write something to publish");
  const when = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = when ? new Date(when) : new Date(Date.now() + 60 * 60 * 1000);
  let accountId = String(formData.get("accountId") ?? "") || null;
  if (accountId) {
    await accountInWorkspace(session.workspaceId, accountId);
  }
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
          handle: "spotted_demo",
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
  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "EDITOR"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the invite");
  const email = parsed.data.email.toLowerCase();
  const role = parsed.data.role as Role;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: existing.id, workspaceId: session.workspaceId } },
      update: { role },
      create: { userId: existing.id, workspaceId: session.workspaceId, role },
    });
    await writeAudit({
      action: "invite.accept",
      userId: session.id,
      workspaceId: session.workspaceId,
      ...(await requestMeta()),
      metadata: { email, existingUser: true },
    });
    revalidatePath("/app/settings/members");
    return;
  }
  const token = crypto.randomUUID();
  await prisma.invite.create({
    data: {
      email,
      token,
      workspaceId: session.workspaceId,
      role,
      invitedById: session.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const link = absoluteUrl(`/signup?invite=${token}`);
  await sendMail({
    to: email,
    subject: `Join ${session.workspaceName} on Spotted`,
    text: `${session.name} invited you to ${session.workspaceName} on Spotted.\n\nAccept the invite:\n${link}\n\nThis link expires in 7 days.`,
  });
  await writeAudit({
    action: "invite.create",
    userId: session.id,
    workspaceId: session.workspaceId,
    ...(await requestMeta()),
    metadata: { email, role },
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
  revalidatePath("/app/settings/platforms");
}

export async function generateReportAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId"));
  await projectInWorkspace(session.workspaceId, projectId);
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

export async function refreshInboxAction() {
  const session = await requireSession();
  const queued = await enqueue("sync-inbox", { workspaceId: session.workspaceId });
  if (!queued) await syncInbox(session.workspaceId);
  revalidatePath("/app/inbox");
}

export async function replyInboxAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  const message = String(formData.get("message") ?? "");
  const item = await inboxInWorkspace(session.workspaceId, id);
  await prisma.inboxItem.update({ where: { id }, data: { status: "REPLIED" } });
  if (item.account && !item.account.isMock && item.account.accessToken) {
    const { getConnector } = await import("./connectors/registry");
    const { tokenOf } = await import("./crypto");
    const connector = getConnector(item.platform);
    await connector?.reply?.({
      query: "",
      accessToken: tokenOf(item.account.accessToken),
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

export async function completeOnboardingAction(formData: FormData) {
  const session = await requireSession();
  if (!canEdit(session.role)) throw new Error("You need editor access");
  const name = String(formData.get("name") ?? "").trim();
  const phrases = parseCsvList(String(formData.get("keywords") ?? ""));
  const sources = formData
    .getAll("sources")
    .map(String)
    .filter((s): s is Source => Object.values(Source).includes(s as Source));
  if (!name) throw new Error("Give your brand a name");
  if (!phrases.length) throw new Error("Add at least one word to watch");
  const project = await prisma.project.create({
    data: {
      name,
      description: "Created from the first-time setup",
      workspaceId: session.workspaceId,
      config: {
        sources: sources.length ? sources : KEYLESS_DEFAULTS,
        competitors: parseCsvList(String(formData.get("competitors") ?? "")),
        webSearchProvider: "brave",
      },
      keywords: { create: phrases.map((phrase) => ({ phrase })) },
    },
  });
  await prisma.workspace.update({
    where: { id: session.workspaceId },
    data: { onboardedAt: new Date() },
  });
  const queued = await enqueue("ingest-project", { projectId: project.id });
  if (!queued) await ingestProject(project.id);
  revalidatePath("/app");
  redirect(`/app?welcome=1`);
}

export async function disconnectAccountAction(formData: FormData) {
  const session = await requireSession();
  if (!canAdmin(session.role)) throw new Error("Admin only");
  const accountId = String(formData.get("accountId") ?? "");
  const account = await accountInWorkspace(session.workspaceId, accountId);
  await prisma.socialAccount.delete({ where: { id: account.id } });
  await writeAudit({
    action: "oauth.disconnect",
    userId: session.id,
    workspaceId: session.workspaceId,
    ...(await requestMeta()),
    metadata: { platform: account.platform, accountId: account.id },
  });
  revalidatePath("/app/settings/platforms");
}

export async function changePasswordAction(formData: FormData) {
  const session = await requireSession();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  assertPassword(next);
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    throw new Error("Current password is wrong");
  }
  await prisma.user.update({
    where: { id: session.id },
    data: { passwordHash: await hashPassword(next) },
  });
  await writeAudit({
    action: "password.change",
    userId: session.id,
    workspaceId: session.workspaceId,
    ...(await requestMeta()),
  });
  revalidatePath("/app/settings/security");
}

export async function logoutEverywhereAction() {
  const session = await requireSession();
  await destroyAllSessions(session.id);
  await writeAudit({
    action: "logout.all",
    userId: session.id,
    workspaceId: session.workspaceId,
    ...(await requestMeta()),
  });
  redirect("/login");
}

export async function startTotpAction() {
  const session = await requireSession();
  if (session.role !== "OWNER") throw new Error("Only the owner can turn on two-factor authentication");
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: session.id },
    data: { totpSecret: sealSecret(secret), totpEnabled: false },
  });
  revalidatePath("/app/settings/security");
}

export async function confirmTotpAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "OWNER") throw new Error("Only the owner can turn on two-factor authentication");
  const code = String(formData.get("totp") ?? "");
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  const secret = openSecret(user?.totpSecret);
  if (!secret || !verifyTotp(secret, code)) throw new Error("That code did not match. Try again.");
  await prisma.user.update({ where: { id: session.id }, data: { totpEnabled: true } });
  await writeAudit({
    action: "totp.enable",
    userId: session.id,
    workspaceId: session.workspaceId,
    ...(await requestMeta()),
  });
  revalidatePath("/app/settings/security");
}

export async function disableTotpAction(formData: FormData) {
  const session = await requireSession();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Password is wrong");
  }
  await prisma.user.update({
    where: { id: session.id },
    data: { totpEnabled: false, totpSecret: null },
  });
  await writeAudit({
    action: "totp.disable",
    userId: session.id,
    workspaceId: session.workspaceId,
    ...(await requestMeta()),
  });
  revalidatePath("/app/settings/security");
}
