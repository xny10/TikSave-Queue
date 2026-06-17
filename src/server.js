import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config.js";
import jobsRouter from "./routes/jobs.routes.js";
import filesRouter from "./routes/files.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Static files (frontend)
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Health check
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: config.appName,
    timestamp: Date.now(),
  });
});

// API routes
app.use("/api/jobs", jobsRouter);
app.use("/api/files", filesRouter);

// Fallback to index.html for SPA
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[Server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
