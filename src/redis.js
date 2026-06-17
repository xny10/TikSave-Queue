import Redis from "ioredis";
import config from "./config.js";

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

export async function connectRedis() {
  if (redis.status === "ready" || redis.status === "connecting") return redis;
  await redis.connect();
  return redis;
}

export default redis;
