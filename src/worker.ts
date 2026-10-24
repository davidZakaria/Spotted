import { scheduleRepeats, startWorker } from "./lib/queue";

async function main() {
  const worker = startWorker();
  worker.on("completed", (job) => {
    console.log(`[worker] ${job.name} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[worker] ${job?.name} failed`, err);
  });
  await scheduleRepeats();
  console.log("Aether worker listening on queue `aether`");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
