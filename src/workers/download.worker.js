import { Worker } from "bullmq";
import redis from "../redis.js";
import config from "../config.js";
import {
  fetchTikwmVideo,
  isRateLimitError,
  FetchError,
} from "../providers/tikwm.provider.js";
import { isCoolingDown, setRateLimitCooldown, trackError, resetErrors } from "../services/cooldown.service.js";
import { getCachedTikwm, setCachedTikwm } from "../services/cache.service.js";
import { downloadVideo, fileExists } from "../services/storage.service.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateItemStatus(jobId, itemId, updates) {
  const itemsRaw = await redis.get(`job:${jobId}:items`);
  if (!itemsRaw) return;

  const items = JSON.parse(itemsRaw);
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;

  items[idx] = { ...items[idx], ...updates };
  await redis.set(`job:${jobId}:items`, JSON.stringify(items));

  // Update job stats
  const jobRaw = await redis.get(`job:${jobId}`);
  if (jobRaw) {
    const job = JSON.parse(jobRaw);
    const waiting = items.filter((i) => i.status === "waiting").length;
    const downloading = items.filter((i) => i.status === "downloading").length;
    const complete = items.filter((i) => i.status === "complete").length;
    const failed = items.filter((i) => i.status === "failed").length;

    job.stats = { total: items.length, waiting, downloading, complete, failed };
    await redis.set(`job:${jobId}`, JSON.stringify(job));
  }
}

const worker = new Worker(
  "tiksave-download",
  async (bullJob) => {
    const { jobId, itemId, url } = bullJob.data;

    console.log(`[Worker] Processing ${itemId} for job ${jobId}`);

    // 1. Check cooldown
    const cooldownMs = await isCoolingDown();
    if (cooldownMs > 0) {
      console.log(`[Worker] Provider cooldown active (${cooldownMs}ms) — waiting`);
      await updateItemStatus(jobId, itemId, { status: "provider_cooldown" });
      // Wait and retry
      await sleep(Math.min(cooldownMs + 1000, config.cooldownOnLimitMs + 1000));
      // Re-check after waiting
      const stillCooldown = await isCoolingDown();
      if (stillCooldown > 0) {
        throw new WorkerError("Provider in cooldown", "provider_cooldown");
      }
    }

    // 2. Global delay
    await sleep(config.downloadDelayMs);

    // 3. Check cache
    let tikwmData = null;
    const cached = await getCachedTikwm(url);
    if (cached) {
      console.log(`[Worker] Cache hit for ${itemId}`);
      tikwmData = cached;
    } else {
      // 4. Call TikWM
      await updateItemStatus(jobId, itemId, { status: "fetching_tikwm" });

      try {
        tikwmData = await fetchTikwmVideo(url);
        await setCachedTikwm(url, tikwmData);
        await resetErrors();
      } catch (err) {
        if (isRateLimitError(err)) {
          console.log(`[Worker] Rate limited — setting cooldown`);
          await setRateLimitCooldown();
          await trackError();
          throw new WorkerError("TikWM rate limited", "provider_cooldown");
        }
        // Track error for long cooldown logic
        await trackError();
        throw err;
      }
    }

    // 5. Update item metadata
    await updateItemStatus(jobId, itemId, {
      status: "downloading",
      title: tikwmData.title,
      author: tikwmData.author,
      cover: tikwmData.cover,
      qualitySource: tikwmData.qualitySource,
      resolution: tikwmData.resolution,
      size: tikwmData.size,
    });

    // 6. Download MP4
    try {
      const filePath = await downloadVideo(jobId, itemId, tikwmData.videoUrl);

      if (!fileExists(filePath)) {
        throw new Error("Downloaded file not found on disk");
      }

      const downloadUrl = `/api/files/${jobId}/${itemId}`;

      await updateItemStatus(jobId, itemId, {
        status: "complete",
        filePath,
        downloadUrl,
      });

      console.log(`[Worker] Complete: ${itemId} → ${filePath}`);
    } catch (downloadErr) {
      console.error(`[Worker] Download failed for ${itemId}:`, downloadErr.message);
      await updateItemStatus(jobId, itemId, {
        status: "failed",
        error: downloadErr.message,
      });
      throw downloadErr;
    }
  },
  {
    connection: redis,
    concurrency: config.maxConcurrency,
    limiter: {
      max: 1,
      duration: config.tikwmRateLimitMs,
    },
  }
);

worker.on("completed", (bullJob) => {
  console.log(`[Worker] Job completed: ${bullJob.id}`);
});

worker.on("failed", (bullJob, err) => {
  console.error(`[Worker] Job failed: ${bullJob?.id} — ${err.message}`);
  // Don't crash on transient failures
});

worker.on("error", (err) => {
  console.error("[Worker] Error:", err.message);
});

class WorkerError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "WorkerError";
    this.status = status || "failed";
  }
}

export default worker;
