import Redis from "ioredis";
import config from "./config.js";

// Railway Redis: URL uses "redis://" scheme but connection REQUIRES TLS.
// Enable TLS for any non-localhost Redis (Railway, Render, Fly.io, etc.)
const isRemoteRedis =
  config.redisUrl.startsWith("rediss://") ||
  (!config.redisUrl.includes("localhost") &&
   !config.redisUrl.includes("127.0.0.1") &&
   !config.redisUrl.includes("0.0.0.0"));

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 10) {
      console.error("[Redis] Max retries reached, giving up");
      return null;
    }
    const delay = Math.min(times * 200, 3000);
    console.log(`[Redis] Retry #${times} in ${delay}ms`);
    return delay;
  },
};

// Enable TLS for Railway & other cloud Redis providers
if (isRemoteRedis) {
  redisOptions.tls = {
    rejectUnauthorized: false,
  };
  console.log("[Redis] TLS enabled for remote Redis");
}

const redis = new Redis(config.redisUrl, redisOptions);

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected" + (isRemoteRedis ? " (TLS)" : ""));
});

redis.on("ready", () => {
  console.log("[Redis] Ready");
});

export async function connectRedis() {
  if (redis.status === "ready") return redis;
  if (redis.status === "connecting" || redis.status === "connect") {
    // Wait for connection to be ready
    await new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve(redis);
      };
      const onError = (err) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        redis.removeListener("ready", onReady);
        redis.removeListener("error", onError);
      };
      redis.once("ready", onReady);
      redis.once("error", onError);
    });
    return redis;
  }
  await redis.connect();
  return redis;
}

export default redis;
