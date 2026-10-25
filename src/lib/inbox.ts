import type { Source } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./connectors/http";

export const INBOX_SYNC_ENDPOINT = "inbox.sync";
export const FACEBOOK_MESSENGER_NOTE = "Facebook didn't allow reading Messenger; reconnect and allow messages";
export const FACEBOOK_MESSENGER_NOTE_AR = "فيسبوك لم يسمح بقراءة ماسنجر. أعد الربط واسمح بالرسائل.";

export function inboxWarningCopy(source: Source, error?: unknown) {
  const text = [
    error instanceof Error ? error.message : error ? String(error) : "",
    error instanceof HttpError ? error.body ?? "" : "",
  ]
    .join(" ")
    .toLowerCase();

  if (source === "FACEBOOK") {
    if (/conversation|messenger|pages_messaging|(#10|#200).*(message|inbox)|permission.*(message|inbox)/.test(text)) {
      return {
        code: "inbox_messenger",
        message: FACEBOOK_MESSENGER_NOTE,
        messageAr: FACEBOOK_MESSENGER_NOTE_AR,
      };
    }
    if (/comment|\/feed|pages_read_user_content|pages_read_engagement/.test(text)) {
      return {
        code: "inbox_comments",
        message: "Facebook didn't allow reading Page comments. Reconnect the Page and allow comments.",
        messageAr: "فيسبوك لم يسمح بقراءة تعليقات الصفحة. أعد ربط الصفحة واسمح بالتعليقات.",
      };
    }
    return {
      code: "inbox_error",
      message: "Facebook didn't send inbox items. Reconnect the Page and check permissions.",
      messageAr: "فيسبوك لم يرسل عناصر الوارد. أعد ربط الصفحة وتحقق من الأذونات.",
    };
  }
  if (source === "GOOGLE_BUSINESS") {
    return {
      code: "inbox_reviews",
      message: "Google Business didn't allow reading reviews. Reconnect the location.",
      messageAr: "جوجل بزنس لم يسمح بقراءة المراجعات. أعد ربط الموقع.",
    };
  }
  return {
    code: "inbox_error",
    message: `${source} inbox could not be refreshed. Try reconnecting the account.`,
    messageAr: `تعذر تحديث وارد ${source}. أعد ربط الحساب.`,
  };
}

export async function warnInbox(
  workspaceId: string | undefined,
  source: Source,
  error?: unknown,
  explicit?: { code?: string; message?: string },
) {
  if (!workspaceId) return;
  const copy = explicit?.message
    ? { code: explicit.code ?? "inbox_error", message: explicit.message }
    : inboxWarningCopy(source, error);
  const project = await prisma.project.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!project) return;
  const recent = await prisma.connectorWarning.findFirst({
    where: {
      projectId: project.id,
      source,
      code: copy.code,
      resolved: false,
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (recent) return;
  await prisma.connectorWarning.create({
    data: { projectId: project.id, source, code: copy.code, message: copy.message },
  });
}

export async function recordInboxSync(workspaceId: string, source: Source = "FACEBOOK") {
  await prisma.apiUsage.create({
    data: {
      workspaceId,
      source,
      endpoint: INBOX_SYNC_ENDPOINT,
      units: 0,
    },
  });
}

export async function lastInboxSyncAt(workspaceId: string) {
  const row = await prisma.apiUsage.findFirst({
    where: { workspaceId, endpoint: INBOX_SYNC_ENDPOINT },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

export async function inboxWarningsForWorkspace(workspaceId: string) {
  return prisma.connectorWarning.findMany({
    where: {
      resolved: false,
      code: { startsWith: "inbox_" },
      project: { workspaceId },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}

export function formatInboxSync(at: Date | null, locale: "en" | "ar") {
  if (!at) return locale === "ar" ? "لم يُزامَن بعد" : "Not synced yet";
  return at.toLocaleString(locale === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" });
}
