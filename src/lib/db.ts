import { PrismaClient } from "@prisma/client";
import { sealSecret } from "./crypto";

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrisma> };

function sealTokenFields(data: unknown) {
  if (!data || typeof data !== "object") return data;
  const row = data as { accessToken?: unknown; refreshToken?: unknown };
  if (typeof row.accessToken === "string") row.accessToken = sealSecret(row.accessToken);
  if (typeof row.refreshToken === "string") row.refreshToken = sealSecret(row.refreshToken);
  return data;
}

function createPrisma() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  return client.$extends({
    query: {
      socialAccount: {
        async $allOperations({ args, query }) {
          const next = args as { data?: unknown; create?: unknown; update?: unknown };
          if (next.data) {
            if (Array.isArray(next.data)) next.data.forEach(sealTokenFields);
            else sealTokenFields(next.data);
          }
          if (next.create) sealTokenFields(next.create);
          if (next.update) sealTokenFields(next.update);
          return query(args);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
