import { enqueue, scheduleRepeats, startWorker } from "./lib/queue";
import { encryptStoredTokens } from "./lib/encrypt-tokens";

async function main() {
  const worker = startWorker();
  worker.on("completed", (job) => {
    console.log(`[worker] ${job.name} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[worker] ${job?.name} failed`, err);
  });
  await scheduleRepeats();
  const queued = await enqueue("ingest-all");
  console.log(queued ? "Queued ingest-all after deploy" : "Could not queue ingest-all; repeats still run every 5 minutes");
  encryptStoredTokens()
    .then((result) => {
      if (result.updated) console.log(`[worker] encrypted ${result.updated} stored token(s)`);
    })
    .catch((error) => {
      console.error("[worker] token encryption skipped", error instanceof Error ? error.message : error);
    });
  console.log("Spotted worker listening on queue `spotted`");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
