-- Fresh installs pick this up after the init migration.
-- Production already has the column; IF NOT EXISTS keeps deploy idempotent.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);
