-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "apifyMonthlyLimitUsd" DOUBLE PRECISION NOT NULL DEFAULT 25;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ScrapeStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScrapeRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdById" TEXT,
    "toolId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "status" "ScrapeStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "apifyRunId" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chargedUsd" DOUBLE PRECISION,
    "items" JSONB NOT NULL DEFAULT '[]',
    "scheduleHours" INTEGER,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScrapeList" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeList_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScrapeRun_workspaceId_createdAt_idx" ON "ScrapeRun"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "ScrapeRun_workspaceId_nextRunAt_idx" ON "ScrapeRun"("workspaceId", "nextRunAt");
CREATE INDEX IF NOT EXISTS "ScrapeRun_status_idx" ON "ScrapeRun"("status");
CREATE INDEX IF NOT EXISTS "ScrapeList_workspaceId_createdAt_idx" ON "ScrapeList"("workspaceId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ScrapeList" ADD CONSTRAINT "ScrapeList_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
