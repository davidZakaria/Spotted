import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

const brandInclude = {
  keywords: true,
  _count: { select: { mentions: true, alerts: true } },
} satisfies Prisma.ProjectInclude;

export async function listBrands(workspaceId: string) {
  return prisma.project.findMany({
    where: { workspaceId },
    include: brandInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getBrand(workspaceId: string, id?: string | null) {
  if (id) {
    const match = await prisma.project.findFirst({
      where: { id, workspaceId },
      include: brandInclude,
    });
    if (match) return match;
  }
  return prisma.project.findFirst({
    where: { workspaceId },
    include: brandInclude,
    orderBy: { updatedAt: "desc" },
  });
}
