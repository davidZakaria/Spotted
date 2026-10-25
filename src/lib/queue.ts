import { Queue, Worker, type Job } from "bullmq";
import { ingestAllActive, ingestProject } from "./jobs/ingest";
import { evaluateAlerts, sendDigests } from "./jobs/alerts";
import { publishDuePosts, syncInbox } from "./jobs/publish";
import { getRedis } from "./redis";

export type JobName = "ingest-project" | "ingest-all" | "evaluate-alerts" | "publish-due" | "send-digests" | "sync-inbox";

let queue: Queue | null = null;

export { getRedis };

export function getQueue() {
  if (!queue) {
    queue = new Queue("spotted", { connection: getRedis() });
  }
  return queue;
}

export async function enqueue(name: JobName, data: Record<string, string> = {}) {
  try {
    await getQueue().add(name, data, { removeOnComplete: 100, removeOnFail: 50 });
    return true;
  } catch {
    return false;
  }
}

export async function runJob(name: JobName, data: Record<string, string> = {}) {
  switch (name) {
    case "ingest-project":
      return ingestProject(data.projectId, {
        forceBackfill: data.forceBackfill === "1",
        keywordId: data.keywordId || undefined,
      });
    case "ingest-all":
      return ingestAllActive();
    case "evaluate-alerts":
      return evaluateAlerts(data.projectId);
    case "publish-due":
      return publishDuePosts();
    case "send-digests":
      return sendDigests();
    case "sync-inbox":
      return syncInbox(data.workspaceId || undefined);
    default:
      return null;
  }
}

export function startWorker() {
  return new Worker(
    "spotted",
    async (job: Job) => runJob(job.name as JobName, job.data ?? {}),
    { connection: getRedis() },
  );
}

export async function scheduleRepeats() {
  const q = getQueue();
  await q.add("ingest-all", {}, { repeat: { every: 5 * 60 * 1000 }, jobId: "repeat-ingest" });
  await q.add("evaluate-alerts", {}, { repeat: { every: 5 * 60 * 1000 }, jobId: "repeat-alerts" });
  await q.add("publish-due", {}, { repeat: { every: 60 * 1000 }, jobId: "repeat-publish" });
  await q.add("send-digests", {}, { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: "repeat-digest" });
  await q.add("sync-inbox", {}, { repeat: { every: 5 * 60 * 1000 }, jobId: "repeat-inbox" });
}
