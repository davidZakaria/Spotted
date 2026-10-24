import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { appConfig } from "./config";
import { ingestAllActive, ingestProject } from "./jobs/ingest";
import { evaluateAlerts, sendDigests } from "./jobs/alerts";
import { publishDuePosts, syncInbox } from "./jobs/publish";

export type JobName = "ingest-project" | "ingest-all" | "evaluate-alerts" | "publish-due" | "send-digests" | "sync-inbox";

let connection: IORedis | null = null;
let queue: Queue | null = null;

export function getRedis() {
  if (!connection) {
    connection = new IORedis(appConfig.redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getQueue() {
  if (!queue) {
    queue = new Queue("aether", { connection: getRedis() });
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
      return ingestProject(data.projectId);
    case "ingest-all":
      return ingestAllActive();
    case "evaluate-alerts":
      return evaluateAlerts(data.projectId);
    case "publish-due":
      return publishDuePosts();
    case "send-digests":
      return sendDigests();
    case "sync-inbox":
      return syncInbox(data.workspaceId);
    default:
      return null;
  }
}

export function startWorker() {
  return new Worker(
    "aether",
    async (job: Job) => runJob(job.name as JobName, job.data ?? {}),
    { connection: getRedis() },
  );
}

export async function scheduleRepeats() {
  const q = getQueue();
  await q.add("ingest-all", {}, { repeat: { every: 15 * 60 * 1000 }, jobId: "repeat-ingest" });
  await q.add("evaluate-alerts", {}, { repeat: { every: 5 * 60 * 1000 }, jobId: "repeat-alerts" });
  await q.add("publish-due", {}, { repeat: { every: 60 * 1000 }, jobId: "repeat-publish" });
  await q.add("send-digests", {}, { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: "repeat-digest" });
}
