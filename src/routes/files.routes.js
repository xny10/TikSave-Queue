import { Router } from "express";
import { createReadStream, existsSync } from "fs";
import redis from "../redis.js";

const router = Router();

// GET /api/files/:jobId/:itemId — download single MP4
router.get("/:jobId/:itemId", async (req, res) => {
  try {
    const { jobId, itemId } = req.params;

    const itemsRaw = await redis.get(`job:${jobId}:items`);
    if (!itemsRaw) {
      return res.status(404).json({ error: "Job not found" });
    }

    const items = JSON.parse(itemsRaw);
    const item = items.find((i) => i.id === itemId);

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (item.status !== "complete") {
      return res.status(400).json({ error: `Item not ready. Current status: ${item.status}` });
    }

    if (item.status === "expired" || !item.filePath) {
      return res.status(410).json({
        error: "File expired or removed. Please create a new download job.",
      });
    }

    const filePath = item.filePath;
    if (!existsSync(filePath)) {
      item.status = "expired";
      item.filePath = null;
      item.downloadUrl = null;
      await redis.set(`job:${jobId}:items`, JSON.stringify(items));
      return res.status(410).json({
        error: "File expired or removed. Please create a new download job.",
      });
    }

    const fileName = `${item.author || "tiktok"}_${itemId}.mp4`.replace(/[<>:"/\\|?*]/g, "_");

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("X-Quality-Source", item.qualitySource || "unknown");
    res.setHeader("X-Resolution", item.resolution || "unknown");

    const stream = createReadStream(filePath);
    stream.on("error", (err) => {
      console.error(`[Files] Stream error for ${filePath}:`, err.message);
      if (!res.headersSent) {
        res.status(410).json({
          error: "File expired or removed. Please create a new download job.",
        });
      }
    });
    stream.pipe(res);
  } catch (err) {
    console.error("[Files] Download error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to download file" });
    }
  }
});



export default router;
