const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 3000,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  appName: process.env.APP_NAME || "TikSave Queue",
  storageDir: process.env.STORAGE_DIR || "/tmp/tiksave",

  // TikWM
  tikwmEndpoint: process.env.TIKWM_ENDPOINT || "https://www.tikwm.com/api/",
  tikwmHd: process.env.TIKWM_HD || "1",

  // Limits
  maxUrlsPerJob: parseInt(process.env.MAX_URLS_PER_JOB, 10) || 10,
  maxConcurrency: parseInt(process.env.MAX_CONCURRENCY, 10) || 1,

  // Rate limiting
  tikwmRateLimitMs: parseInt(process.env.TIKWM_RATE_LIMIT_MS, 10) || 2500,
  downloadDelayMs: parseInt(process.env.DOWNLOAD_DELAY_MS, 10) || 2500,

  // Retry
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS, 10) || 2,
  retryDelay1Ms: parseInt(process.env.RETRY_DELAY_1_MS, 10) || 30000,
  retryDelay2Ms: parseInt(process.env.RETRY_DELAY_2_MS, 10) || 60000,

  // Cooldown
  cooldownOnLimitMs: parseInt(process.env.COOLDOWN_ON_LIMIT_MS, 10) || 60000,
  longCooldownMs: parseInt(process.env.LONG_COOLDOWN_MS, 10) || 300000,
  maxProviderErrors: parseInt(process.env.MAX_PROVIDER_ERRORS, 10) || 3,

  // Cache
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 600,

  // Expiry & cleanup
  jobExpireMinutes: parseInt(process.env.JOB_EXPIRE_MINUTES, 10) || 10,
  cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS, 10) || 60000,
};

export default config;
