-- One-time 365-day history scan per watched word
ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "backfilledAt" TIMESTAMP(3);
