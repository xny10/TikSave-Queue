import redis from "../redis.js";
import config from "../config.js";

const COOLDOWN_KEY = "cooldown:tikwm";
const ERROR_COUNT_KEY = "errors:tikwm";

/**
 * Check if the provider is currently in cooldown.
 * Returns remaining milliseconds, or 0 if not active.
 */
export async function isCoolingDown() {
  const ttl = await redis.ttl(COOLDOWN_KEY);
  return ttl > 0 ? ttl * 1000 : 0;
}

/**
 * Get remaining cooldown in milliseconds.
 */
export async function getRemainingCooldownMs() {
  return await isCoolingDown();
}

/**
 * Set a cooldown for the given duration (milliseconds).
 */
export async function setCooldown(durationMs) {
  const seconds = Math.ceil(durationMs / 1000);
  await redis.set(COOLDOWN_KEY, "1", "EX", seconds);
  console.log(`[Cooldown] Set cooldown for ${seconds}s`);
}

/**
 * Set standard cooldown (60s rate-limit).
 */
export async function setRateLimitCooldown() {
  await setCooldown(config.cooldownOnLimitMs);
}

/**
 * Set long cooldown (5min after repeated errors).
 */
export async function setLongCooldown() {
  await setCooldown(config.longCooldownMs);
}

/**
 * Reset the cooldown immediately.
 */
export async function resetCooldown() {
  await redis.del(COOLDOWN_KEY);
}

/**
 * Track a provider error. If consecutive errors reach threshold,
 * trigger a long cooldown.
 * Returns true if long cooldown was triggered.
 */
export async function trackError() {
  const count = await redis.incr(ERROR_COUNT_KEY);
  if (count === 1) {
    // Set expiry on the error counter (keep for up to 10 minutes)
    await redis.expire(ERROR_COUNT_KEY, 600);
  }

  if (count >= config.maxProviderErrors) {
    console.log(`[Cooldown] ${count} consecutive errors — triggering long cooldown`);
    await setLongCooldown();
    await resetErrors();
    return true;
  }

  return false;
}

/**
 * Reset consecutive error counter.
 */
export async function resetErrors() {
  await redis.del(ERROR_COUNT_KEY);
}
