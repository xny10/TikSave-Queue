import { createHash } from "crypto";
import redis from "../redis.js";
import config from "../config.js";

const CACHE_PREFIX = "cache:tikwm:";

function hashUrl(url) {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

/**
 * Get cached TikWM result for a URL.
 * Returns null if not found.
 */
export async function getCachedTikwm(url) {
  const key = `${CACHE_PREFIX}${hashUrl(url)}`;
  const raw = await redis.get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Set cached TikWM result for a URL.
 */
export async function setCachedTikwm(url, data) {
  const key = `${CACHE_PREFIX}${hashUrl(url)}`;
  await redis.set(key, JSON.stringify(data), "EX", config.cacheTtlSeconds);
}

/**
 * Clear cache for a specific URL.
 */
export async function clearCachedTikwm(url) {
  const key = `${CACHE_PREFIX}${hashUrl(url)}`;
  await redis.del(key);
}
