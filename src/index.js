import config from "./config.js";
import { connectRedis } from "./redis.js";
import worker from "./workers/download.worker.js";
import app from "./server.js";
import { startCleanup } from "./services/cleanup.service.js";

async function main() {
  console.log(`\n═══════════════════════════════════`);
  console.log(`  ${config.appName}`);
  console.log(`═══════════════════════════════════\n`);

  // Connect to Redis
  console.log(`[Startup] Connecting to Redis...`);
  await connectRedis();
  console.log(`[Startup] Redis connected`);

  // Wait for worker to be ready
  await worker.waitUntilReady();
  console.log(`[Startup] BullMQ worker ready (concurrency: ${config.maxConcurrency})`);

  // Start cleanup loop
  startCleanup();

  // Start HTTP server
  app.listen(config.port, () => {
    console.log(`\n[Server] ${config.appName} running on port ${config.port}`);
    console.log(`[Server] http://localhost:${config.port}`);
    console.log(`[Server] Health: http://localhost:${config.port}/health\n`);
  });
}

main().catch((err) => {
  console.error("[Fatal] Startup failed:", err);
  process.exit(1);
});
