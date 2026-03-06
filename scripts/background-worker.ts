import { startBackgroundWorker } from "../lib/queue/background-worker";
import { logger } from "../lib/logger";

async function main() {
  const worker = await startBackgroundWorker();

  if (!worker) {
    logger.error("Background worker exited: queue unavailable");
    process.exit(1);
    return;
  }

  const shutdown = async (signal: string) => {
    logger.info("Shutting down background worker", {
      signal,
    });

    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void main();
