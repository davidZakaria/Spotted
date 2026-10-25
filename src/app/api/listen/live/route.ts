import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runLiveSearch } from "@/lib/listen/live";
import { csvWords, ruleFromPhrase } from "@/lib/listen/query";
import type { ProjectConfig } from "@/lib/connectors/types";
import { liveSearchSchema } from "@/lib/validation";
import { consumeRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { tokenOf } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Sign in first", { status: 401 });

  const url = new URL(req.url);
  const parsed = liveSearchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    projectId: url.searchParams.get("projectId") ?? "",
    matchType: url.searchParams.get("matchType") || undefined,
    required: url.searchParams.get("required") || undefined,
    excluded: url.searchParams.get("excluded") || undefined,
    boolean: url.searchParams.get("boolean") || undefined,
    language: url.searchParams.get("language") || undefined,
    country: url.searchParams.get("country") || undefined,
    synonyms: url.searchParams.get("synonyms") || undefined,
  });
  if (!parsed.success) return new Response(parsed.error.issues[0]?.message ?? "Invalid search", { status: 400 });

  const ip = clientIp(req.headers);
  const [userLimit, ipLimit] = await Promise.all([
    consumeRateLimit({ key: `live:${session.id}`, limit: 10, windowSec: 60 }),
    consumeRateLimit({ key: `live:ip:${ip}`, limit: 20, windowSec: 60 }),
  ]);
  if (!userLimit.allowed) return rateLimitResponse(userLimit, "Too many live searches. Wait a minute.");
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit, "Too many live searches. Wait a minute.");

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, workspaceId: session.workspaceId },
    include: {
      workspace: {
        include: {
          accounts: {
            select: {
              id: true,
              platform: true,
              isMock: true,
              externalId: true,
              accessToken: true,
            },
          },
        },
      },
    },
  });
  if (!project) return new Response("Brand not found", { status: 404 });

  const rule = ruleFromPhrase(parsed.data.q, {
    matchType: parsed.data.matchType || "CONTAINS",
    requiredWords: csvWords(parsed.data.required),
    excludedWords: csvWords(parsed.data.excluded),
    booleanQuery: parsed.data.boolean || null,
    language: parsed.data.language || null,
    country: parsed.data.country || null,
    synonyms: csvWords(parsed.data.synonyms),
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await runLiveSearch({
          rule,
          workspaceId: session.workspaceId,
          projectId: project.id,
          config: (project.config ?? {}) as ProjectConfig,
          connected: project.workspace.accounts.map((account) => ({
            ...account,
            accessToken: tokenOf(account.accessToken) ?? null,
          })),
          persist: true,
          onProgress: async ({ type, plan, progress, hits, total }) => {
            if (type === "plan") send("plan", { plan });
            if (type === "source" && progress) send("source", progress);
            if (type === "hits") send("hits", { progress, hits });
            if (type === "done") send("done", { total });
          },
        });
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : "Search failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
