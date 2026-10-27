import { prisma } from "../db";
import { persistMentions } from "./ingest";
import {
  apifyMonthlyLimitUsd,
  fetchApifyUsage,
  getApifyItems,
  hasApifyToken,
  missingTokenMessage,
  startApifyRun,
  waitForApifyRun,
} from "../scrape/apify";
import { scrapeItemToMention, scrapeTool } from "../scrape/tools";
import { monthStart } from "../listen/serpapi";

export async function workspaceScrapeSpend(workspaceId: string) {
  const used = await prisma.scrapeRun.aggregate({
    where: {
      workspaceId,
      createdAt: { gte: monthStart() },
      status: { in: ["SUCCEEDED", "RUNNING", "QUEUED"] },
    },
    _sum: { estimatedCostUsd: true },
  });
  return used._sum.estimatedCostUsd ?? 0;
}

export async function scrapeBudget(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { apifyMonthlyLimitUsd: true },
  });
  const limit = apifyMonthlyLimitUsd(workspace?.apifyMonthlyLimitUsd);
  const localUsed = await workspaceScrapeSpend(workspaceId);
  const remote = hasApifyToken() ? await fetchApifyUsage() : { usedUsd: 0 };
  const used = Math.max(localUsed, remote.usedUsd);
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    username: remote.username,
    hasToken: hasApifyToken(),
  };
}

export async function executeScrapeRun(runId: string) {
  const run = await prisma.scrapeRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Scrape run not found");
  if (!hasApifyToken()) {
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: { status: "FAILED", error: missingTokenMessage("en"), finishedAt: new Date() },
    });
    return { status: "FAILED" as const };
  }
  const budget = await scrapeBudget(run.workspaceId);
  if (budget.remaining < run.estimatedCostUsd) {
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        error: `Monthly scraper spend limit reached ($${budget.used.toFixed(2)} of $${budget.limit}). Raise APIFY_MONTHLY_LIMIT_USD or wait until next month.`,
        finishedAt: new Date(),
      },
    });
    return { status: "FAILED" as const };
  }
  await prisma.scrapeRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });
  try {
    const started = await startApifyRun(run.actorId, (run.input ?? {}) as Record<string, unknown>);
    await prisma.scrapeRun.update({ where: { id: runId }, data: { apifyRunId: started.runId } });
    const finished = await waitForApifyRun(started.runId);
    const status = (finished.status ?? "").toUpperCase();
    if (status !== "SUCCEEDED") {
      throw new Error(finished.statusMessage || `Apify run ended with ${status || "an unknown status"}`);
    }
    const datasetId = finished.defaultDatasetId || started.datasetId;
    const items = datasetId ? await getApifyItems(datasetId) : [];
    const nextRunAt =
      run.scheduleHours && run.scheduleHours > 0
        ? new Date(Date.now() + run.scheduleHours * 60 * 60 * 1000)
        : null;
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        status: "SUCCEEDED",
        items,
        itemCount: items.length,
        chargedUsd: typeof finished.usageTotalUsd === "number" ? finished.usageTotalUsd : run.estimatedCostUsd,
        finishedAt: new Date(),
        nextRunAt,
      },
    });
    return { status: "SUCCEEDED" as const, itemCount: items.length };
  } catch (error) {
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Scraper failed",
        finishedAt: new Date(),
      },
    });
    return { status: "FAILED" as const };
  }
}

export async function runDueScrapes() {
  const due = await prisma.scrapeRun.findMany({
    where: {
      scheduleHours: { gt: 0 },
      nextRunAt: { lte: new Date() },
      status: { in: ["SUCCEEDED", "FAILED"] },
    },
    take: 10,
  });
  const started: string[] = [];
  for (const template of due) {
    const copy = await prisma.scrapeRun.create({
      data: {
        workspaceId: template.workspaceId,
        projectId: template.projectId,
        createdById: template.createdById,
        toolId: template.toolId,
        actorId: template.actorId,
        title: `${template.title} (scheduled)`,
        input: template.input ?? {},
        estimatedCostUsd: template.estimatedCostUsd,
        status: "QUEUED",
      },
    });
    await prisma.scrapeRun.update({
      where: { id: template.id },
      data: { nextRunAt: new Date(Date.now() + (template.scheduleHours ?? 24) * 60 * 60 * 1000) },
    });
    await executeScrapeRun(copy.id);
    started.push(copy.id);
  }
  return started;
}

export async function saveScrapeToMentions(runId: string, projectId: string) {
  const run = await prisma.scrapeRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Scrape run not found");
  const tool = scrapeTool(run.toolId);
  if (!tool) throw new Error("Unknown scraper tool");
  const items = Array.isArray(run.items) ? (run.items as Record<string, unknown>[]) : [];
  const mentions = items
    .map((item, index) => scrapeItemToMention(tool, item, index))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return persistMentions(
    projectId,
    mentions.map((mention) => ({ mention })),
  );
}
