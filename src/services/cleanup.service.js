import redis from "../redis.js";
import { deleteJobDir } from "./storage.service.js";
import config from "../config.js";

let cleanupTimer = null;

/**
 * Run cleanup: find expired jobs and delete their files + update status.
 */
export async function runCleanup() {
  try {
    const jobIds = await redis.smembers("jobs:index");
    const now = Date.now();
    let expiredCount = 0;

    for (const jobId of jobIds) {
      const expiresRaw = await redis.get(`job:${jobId}:expires`);
      if (!expiresRaw) continue;

      const expiresAt = parseInt(expiresRaw, 10);
      if (now < expiresAt) continue;

      // Job expired — delete files
      await deleteJobDir(jobId);

      // Update items to expired
      const itemsRaw = await redis.get(`job:${jobId}:items`);
      if (itemsRaw) {
        const items = JSON.parse(itemsRaw);
        for (const item of items) {
          if (item.status === "complete") {
            item.status = "expired";
            item.filePath = null;
            item.downloadUrl = null;
          }
        }
        await redis.set(`job:${jobId}:items`, JSON.stringify(items));
      }

      // Update job status
      const jobRaw = await redis.get(`job:${jobId}`);
      if (jobRaw) {
        const job = JSON.parse(jobRaw);
        job.status = "expired";
        await redis.set(`job:${jobId}`, JSON.stringify(job));
      }

      // Remove from active index
      await redis.srem("jobs:index", jobId);
      expiredCount++;
    }

    if (expiredCount > 0) {
      console.log(`[Cleanup] Expired ${expiredCount} job(s)`);
    }
  } catch (err) {
    console.error("[Cleanup] Error:", err.message);
  }
}

/**
 * Start the cleanup interval.
 */
export function startCleanup() {
  console.log(`[Cleanup] Starting, interval: ${config.cleanupIntervalMs}ms`);
  cleanupTimer = setInterval(runCleanup, config.cleanupIntervalMs);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Stop the cleanup interval.
 */
export function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
