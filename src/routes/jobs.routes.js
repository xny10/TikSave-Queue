import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createReadStream, existsSync } from "fs";
import archiver from "archiver";
import redis from "../redis.js";
import tiksaveQueue from "../queue.js";
import config from "../config.js";

const router = Router();

const createJobSchema = z.object({
  urls: z.array(z.string().min(1)).min(1, "At least 1 URL required"),
});

const TIKTOK_DOMAINS = ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"];

function extractTikTokUrls(rawUrls) {
  const trimmed = rawUrls.map((u) => u.trim()).filter(Boolean);

  const valid = trimmed.filter((url) => {
    try {
      const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
      return TIKTOK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
      return TIKTOK_DOMAINS.some((d) => url.includes(d));
    }
  });

  return [...new Set(valid)];
}

// POST /api/jobs — create a new job
router.post("/", async (req, res) => {
  try {
    const parseResult = createJobSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parseResult.error.flatten(),
      });
    }

    const urls = extractTikTokUrls(parseResult.data.urls);

    if (urls.length === 0) {
      return res.status(400).json({
        error: "No valid TikTok URLs found",
      });
    }

    if (urls.length > config.maxUrlsPerJob) {
      return res.status(400).json({
        error: `Maximum ${config.maxUrlsPerJob} URLs per job allowed`,
      });
    }

    const jobId = `job_${nanoid(12)}`;
    const now = Date.now();
    const expiresAt = now + config.jobExpireMinutes * 60 * 1000;

    const items = urls.map((url, i) => ({
      id: `item_${i + 1}_${nanoid(6)}`,
      index: i + 1,
      url,
      status: "waiting",
      title: null,
      author: null,
      cover: null,
      qualitySource: null,
      resolution: null,
      size: null,
      filePath: null,
      downloadUrl: null,
      error: null,
      createdAt: now,
    }));

    const jobData = {
      id: jobId,
      totalUrls: urls.length,
      urlCount: urls.length,
      duplicateCount: urls.length - urls.length,
      urls,
      status: "active",
      stats: {
        total: urls.length,
        waiting: urls.length,
        downloading: 0,
        complete: 0,
        failed: 0,
      },
      createdAt: now,
      expiresAt,
    };

    // Save job
    await redis.set(`job:${jobId}`, JSON.stringify(jobData));
    await redis.set(`job:${jobId}:expires`, expiresAt);
    await redis.sadd("jobs:index", jobId);

    // Save items
    await redis.set(`job:${jobId}:items`, JSON.stringify(items));

    // Enqueue each item
    for (const item of items) {
      await tiksaveQueue.add(
        "download",
        {
          jobId,
          itemId: item.id,
          url: item.url,
        },
        {
          jobId: `${jobId}:${item.id}`,
        }
      );
    }

    return res.status(201).json({
      ok: true,
      jobId,
      job: jobData,
      items: items.map((it) => ({
        id: it.id,
        index: it.index,
        url: it.url,
        status: it.status,
      })),
    });
  } catch (err) {
    console.error("[Jobs] Create error:", err);
    return res.status(500).json({ error: "Failed to create job" });
  }
});

// GET /api/jobs/:jobId — get job status
router.get("/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    const jobRaw = await redis.get(`job:${jobId}`);
    if (!jobRaw) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = JSON.parse(jobRaw);
    const itemsRaw = await redis.get(`job:${jobId}:items`);
    const items = itemsRaw ? JSON.parse(itemsRaw) : [];

    return res.json({
      ok: true,
      job: { ...job },
      items,
    });
  } catch (err) {
    console.error("[Jobs] Get error:", err);
    return res.status(500).json({ error: "Failed to get job" });
  }
});

// POST /api/jobs/:jobId/retry-failed — retry failed items
router.post("/:jobId/retry-failed", async (req, res) => {
  try {
    const { jobId } = req.params;

    const itemsRaw = await redis.get(`job:${jobId}:items`);
    if (!itemsRaw) {
      return res.status(404).json({ error: "Job not found" });
    }

    const items = JSON.parse(itemsRaw);
    let retried = 0;

    for (const item of items) {
      if (item.status === "failed") {
        item.status = "waiting";
        item.error = null;
        item.filePath = null;
        item.downloadUrl = null;

        await tiksaveQueue.add(
          "download",
          {
            jobId,
            itemId: item.id,
            url: item.url,
          },
          {
            jobId: `${jobId}:${item.id}-retry`,
          }
        );
        retried++;
      }
    }

    // Update stats
    const waiting = items.filter((i) => i.status === "waiting").length;
    const complete = items.filter((i) => i.status === "complete").length;
    const failed = items.filter((i) => i.status === "failed").length;
    const downloading = items.filter((i) => i.status === "downloading").length;

    await redis.set(`job:${jobId}:items`, JSON.stringify(items));

    const jobRaw = await redis.get(`job:${jobId}`);
    if (jobRaw) {
      const job = JSON.parse(jobRaw);
      job.stats = {
        total: items.length,
        waiting,
        downloading,
        complete,
        failed,
      };
      await redis.set(`job:${jobId}`, JSON.stringify(job));
    }

    return res.json({
      ok: true,
      retried,
      stats: { waiting, downloading, complete, failed },
    });
  } catch (err) {
    console.error("[Jobs] Retry error:", err);
    return res.status(500).json({ error: "Failed to retry items" });
  }
});

// GET /api/jobs/:jobId/zip — create and stream ZIP of all complete files
router.get("/:jobId/zip", async (req, res) => {
  try {
    const { jobId } = req.params;

    const itemsRaw = await redis.get(`job:${jobId}:items`);
    if (!itemsRaw) {
      return res.status(404).json({ error: "Job not found" });
    }

    const items = JSON.parse(itemsRaw);
    const completeItems = items.filter((i) => i.status === "complete" && i.filePath);

    const availableItems = completeItems.filter((i) => existsSync(i.filePath));

    if (availableItems.length === 0) {
      return res.status(410).json({
        error: "No files available. Files may have expired.",
      });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="tiksave_${jobId}.zip"`);

    const archive = archiver("zip", { zlib: { level: 5 } });

    archive.on("error", (err) => {
      console.error("[Jobs] ZIP error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create ZIP" });
      }
    });

    archive.pipe(res);

    for (const item of availableItems) {
      const fileName = `${item.author || "tiktok"}_${item.id}.mp4`.replace(/[<>:"/\\|?*]/g, "_");
      archive.file(item.filePath, { name: fileName });
    }

    await archive.finalize();
  } catch (err) {
    console.error("[Jobs] ZIP error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to create ZIP" });
    }
  }
});

export default router;
