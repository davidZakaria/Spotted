import { Source } from "@prisma/client";
import { prisma } from "../db";

export const DEFAULT_COSTS: Partial<Record<Source, number>> = {
  X: 0.005,
  YOUTUBE: 0,
  FACEBOOK: 0,
  INSTAGRAM: 0,
  WEB_SEARCH: 0.003,
};

export async function assertBudget(workspaceId: string | undefined, source: Source) {
  if (!workspaceId) return { allowed: true, reason: null as string | null };
  const budget = await prisma.connectorBudget.findUnique({
    where: { workspaceId_source: { workspaceId, source } },
  });
  if (!budget || !budget.enabled) return { allowed: true, reason: null };
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [daily, monthly] = await Promise.all([
    prisma.apiUsage.aggregate({
      where: { workspaceId, source, createdAt: { gte: dayStart } },
      _sum: { units: true, estimatedCostUsd: true },
    }),
    prisma.apiUsage.aggregate({
      where: { workspaceId, source, createdAt: { gte: monthStart } },
      _sum: { units: true, estimatedCostUsd: true },
    }),
  ]);
  const dailyCalls = daily._sum.units ?? 0;
  const monthlyCalls = monthly._sum.units ?? 0;
  const monthlySpend = monthly._sum.estimatedCostUsd ?? 0;
  if (dailyCalls >= budget.dailyCallLimit) {
    return { allowed: false, reason: `${source} daily call budget reached (${budget.dailyCallLimit})` };
  }
  if (monthlyCalls >= budget.monthlyCallLimit) {
    return { allowed: false, reason: `${source} monthly call budget reached (${budget.monthlyCallLimit})` };
  }
  if (monthlySpend >= budget.monthlySpendLimitUsd) {
    return { allowed: false, reason: `${source} monthly spend budget reached ($${budget.monthlySpendLimitUsd})` };
  }
  return { allowed: true, reason: null };
}

export async function recordUsage(opts: {
  workspaceId?: string;
  source: Source;
  endpoint: string;
  units?: number;
  costPerCallUsd?: number;
}) {
  if (!opts.workspaceId) return;
  const budget = await prisma.connectorBudget.findUnique({
    where: { workspaceId_source: { workspaceId: opts.workspaceId, source: opts.source } },
  });
  const cost = opts.costPerCallUsd ?? budget?.costPerCallUsd ?? DEFAULT_COSTS[opts.source] ?? 0;
  const units = opts.units ?? 1;
  await prisma.apiUsage.create({
    data: {
      workspaceId: opts.workspaceId,
      source: opts.source,
      endpoint: opts.endpoint,
      units,
      estimatedCostUsd: cost * units,
    },
  });
}

export async function usageSummary(workspaceId: string, source: Source) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const budget = await prisma.connectorBudget.findUnique({
    where: { workspaceId_source: { workspaceId, source } },
  });
  const [daily, monthly] = await Promise.all([
    prisma.apiUsage.aggregate({
      where: { workspaceId, source, createdAt: { gte: dayStart } },
      _sum: { units: true, estimatedCostUsd: true },
    }),
    prisma.apiUsage.aggregate({
      where: { workspaceId, source, createdAt: { gte: monthStart } },
      _sum: { units: true, estimatedCostUsd: true },
    }),
  ]);
  return {
    source,
    dailyCalls: daily._sum.units ?? 0,
    monthlyCalls: monthly._sum.units ?? 0,
    monthlySpendUsd: monthly._sum.estimatedCostUsd ?? 0,
    budget,
  };
}

export async function warnProject(projectId: string | undefined, source: Source, code: string, message: string) {
  if (!projectId) return;
  await prisma.connectorWarning.create({ data: { projectId, source, code, message } });
}
