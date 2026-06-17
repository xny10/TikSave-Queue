import { Queue } from "bullmq";
import redis from "./redis.js";
import config from "./config.js";

const tiksaveQueue = new Queue("tiksave-download", {
  connection: redis,
  defaultJobOptions: {
    attempts: config.retryAttempts + 1,
    backoff: {
      type: "fixed",
      delay: config.retryDelay1Ms,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export default tiksaveQueue;
