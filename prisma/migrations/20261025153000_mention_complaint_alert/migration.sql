-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'COMPLAINT';

-- AlterTable
ALTER TABLE "Mention" ADD COLUMN IF NOT EXISTS "complaint" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Mention_projectId_complaint_idx" ON "Mention"("projectId", "complaint");
