import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertSchemaMatchesMigrations } from "../scripts/check-prisma-sync";

function migrationSql() {
  const root = "prisma/migrations";
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const file = join(root, entry.name, "migration.sql");
      return [readFileSync(file, "utf8")];
    })
    .join("\n");
}

describe("prisma schema and migrations", () => {
  it("adds GOOGLE_MAPS, Mention.rating, and Keyword requiredAny with idempotent SQL", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/GOOGLE_MAPS/);
    expect(schema).toMatch(/requiredAny\s+String\[\]/);
    expect(schema).toMatch(/requiredAnyWhen\s+String\[\]/);
    expect(schema).toMatch(/model Mention[\s\S]*rating\s+Int\?/);
    expect(migrationSql()).toMatch(/ALTER TYPE "Source" ADD VALUE IF NOT EXISTS 'GOOGLE_MAPS'/);
    expect(migrationSql()).toMatch(/ADD COLUMN IF NOT EXISTS "requiredAny"/);
    expect(migrationSql()).toMatch(/ADD COLUMN IF NOT EXISTS "rating"/);
  });

  it("adds Mention.complaint and AlertType COMPLAINT with idempotent SQL", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/model Mention[\s\S]*complaint\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/enum AlertType[\s\S]*COMPLAINT/);
    expect(migrationSql()).toMatch(/ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'COMPLAINT'/);
    expect(migrationSql()).toMatch(/ALTER TABLE "Mention" ADD COLUMN IF NOT EXISTS "complaint" BOOLEAN NOT NULL DEFAULT false/);
  });

  it("adds Keyword.backfilledAt with idempotent SQL", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/model Keyword[\s\S]*backfilledAt\s+DateTime\?/);
    expect(migrationSql()).toMatch(
      /ALTER TABLE "Keyword" ADD COLUMN IF NOT EXISTS "backfilledAt" TIMESTAMP\(3\);/,
    );
  });

  it("adds ScrapeRun, ScrapeList, and Workspace.apifyMonthlyLimitUsd", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/model ScrapeRun/);
    expect(schema).toMatch(/model ScrapeList/);
    expect(schema).toMatch(/apifyMonthlyLimitUsd/);
    expect(migrationSql()).toMatch(/CREATE TABLE IF NOT EXISTS "ScrapeRun"/);
    expect(migrationSql()).toMatch(/ADD COLUMN IF NOT EXISTS "apifyMonthlyLimitUsd"/);
  });

  it("adds Workspace.onboardedAt with idempotent SQL", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/model Workspace[\s\S]*onboardedAt\s+DateTime\?/);
    expect(migrationSql()).toMatch(
      /ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP\(3\);/,
    );
  });

  it("keeps schema.prisma in sync with prisma/migrations", () => {
    expect(() => assertSchemaMatchesMigrations()).not.toThrow();
  });
});
