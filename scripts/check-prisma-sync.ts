import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  if (!existsSync(".env")) return "";
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^DATABASE_URL\s*=\s*(.*)$/);
    if (!match) continue;
    return match[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return "";
}

function shadowDatabaseUrl() {
  const raw = loadDatabaseUrl();
  if (!raw) {
    throw new Error("DATABASE_URL is required to check that Prisma schema and migrations match");
  }
  const url = new URL(raw);
  url.pathname = "/spotted_migrate_shadow";
  return url.toString();
}

function ensureShadowDatabase() {
  const raw = loadDatabaseUrl();
  const url = new URL(raw);
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGDATABASE: url.pathname.replace(/^\//, "") || "postgres",
  };
  try {
    execFileSync("createdb", ["spotted_migrate_shadow"], { env, stdio: "pipe" });
  } catch (error) {
    const stderr = String((error as { stderr?: Buffer }).stderr ?? "");
    if (!/already exists/i.test(stderr)) throw error;
  }
}

export function assertSchemaMatchesMigrations() {
  const prismaBin = resolve("node_modules/prisma/build/index.js");
  if (!existsSync(prismaBin)) {
    throw new Error("prisma CLI is not installed");
  }
  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to check that Prisma schema and migrations match");
  }
  ensureShadowDatabase();
  execFileSync(
    process.execPath,
    [
      prismaBin,
      "migrate",
      "diff",
      "--from-migrations",
      "prisma/migrations",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--shadow-database-url",
      shadowDatabaseUrl(),
      "--exit-code",
    ],
    { stdio: "pipe", env: { ...process.env, DATABASE_URL: databaseUrl } },
  );
}

if (process.argv[1] && process.argv[1].endsWith("check-prisma-sync.ts")) {
  try {
    assertSchemaMatchesMigrations();
    console.log("Prisma schema and migrations are in sync.");
  } catch (error) {
    const err = error as { stderr?: Buffer; stdout?: Buffer; message?: string };
    if (err.stderr?.length) process.stderr.write(err.stderr);
    if (err.stdout?.length) process.stdout.write(err.stdout);
    console.error(err.message ?? error);
    process.exit(1);
  }
}
