import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runLiveSearch } from "@/lib/listen/live";
import { csvWords, ruleFromPhrase } from "@/lib/listen/query";
import type { ProjectConfig } from "@/lib/connectors/types";
import type { MatchType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Sign in first", { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const projectId = url.searchParams.get("projectId") ?? "";
  if (!q || !projectId) return new Response("Missing search word or brand", { status: 400 });

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: session.workspaceId },
    include: { workspace: { include: { accounts: true } } },
  });
  if (!project) return new Response("Brand not found", { status: 404 });

  const rule = ruleFromPhrase(q, {
    matchType: (url.searchParams.get("matchType") as MatchType) || "CONTAINS",
    requiredWords: csvWords(url.searchParams.get("required")),
    excludedWords: csvWords(url.searchParams.get("excluded")),
    booleanQuery: url.searchParams.get("boolean") || null,
    language: url.searchParams.get("language") || null,
    country: url.searchParams.get("country") || null,
    synonyms: csvWords(url.searchParams.get("synonyms")),
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
          connected: project.workspace.accounts,
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
