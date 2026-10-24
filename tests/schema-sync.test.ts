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
