import { mkdir, rm } from "fs/promises";
import { createWriteStream, existsSync } from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import config from "../config.js";

/**
 * Get the directory for a job's files.
 */
export function getJobDir(jobId) {
  return path.join(config.storageDir, "jobs", jobId);
}

/**
 * Get the file path for an item.
 */
export function getItemPath(jobId, itemId) {
  return path.join(getJobDir(jobId), `${itemId}_new.mp4`);
}

/**
 * Ensure the job directory exists.
 */
export async function ensureJobDir(jobId) {
  const dir = getJobDir(jobId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

/**
 * Download a video from a URL to the storage path.
 */
export async function downloadVideo(jobId, itemId, videoUrl) {
  const filePath = getItemPath(jobId, itemId);
  await ensureJobDir(jobId);

  const res = await fetch(videoUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 TikSaveQueue/1.0",
    },
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }

  const writer = createWriteStream(filePath);
  await pipeline(res.body, writer);

  return filePath;
}

/**
 * Delete a job's entire directory.
 */
export async function deleteJobDir(jobId) {
  const dir = getJobDir(jobId);
  try {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`[Storage] Failed to delete ${dir}:`, err.message);
  }
}

/**
 * Check if a file exists on disk.
 */
export function fileExists(filePath) {
  return existsSync(filePath);
}
