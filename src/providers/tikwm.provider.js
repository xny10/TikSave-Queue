import config from "../config.js";

/**
 * Fetch TikTok video metadata from TikWM API.
 * Priority: hdplay → play → wmplay → video
 */
export async function fetchTikwmVideo(tiktokUrl) {
  const endpoint = config.tikwmEndpoint;
  const hd = config.tikwmHd;

  const body = new URLSearchParams();
  body.set("url", tiktokUrl);
  body.set("hd", hd);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 TikSaveQueue/1.0",
    },
    body,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new FetchError(`TikWM HTTP error: ${res.status}`, res.status);
  }

  const json = await res.json();

  if (json.code !== 0) {
    throw new FetchError(json.msg || "TikWM failed to process video", json.code ?? -1);
  }

  if (!json.data) {
    throw new FetchError("TikWM returned empty data", -1);
  }

  const data = json.data;
  const bestVideoUrl = pickBestVideoUrl(data);

  if (!bestVideoUrl) {
    throw new FetchError("No downloadable video URL returned by TikWM", -1);
  }

  return {
    id: data.id || data.video_id || null,
    title: data.title || "TikTok Video",
    author: data.author?.unique_id || data.author?.nickname || null,
    cover: toAbsoluteUrl(data.cover || data.origin_cover || null),
    videoUrl: toAbsoluteUrl(bestVideoUrl),
    qualitySource: getQualitySource(data),
    resolution: getResolutionLabel(data),
    size: data.hd_size || data.size || data.wm_size || null,
    raw: data,
  };
}

export function pickBestVideoUrl(data) {
  return data.hdplay || data.play || data.wmplay || data.video || null;
}

export function getQualitySource(data) {
  if (data.hdplay) return "hdplay";
  if (data.play) return "play";
  if (data.wmplay) return "wmplay";
  if (data.video) return "video";
  return "unknown";
}

export function getResolutionLabel(data) {
  if (data.hdplay) return "Highest Available / HD";
  if (data.play) return "Highest Available";
  if (data.wmplay) return "Watermark Fallback";
  return "Unknown";
}

export function toAbsoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://www.tikwm.com${url}`;
  return url;
}

export class FetchError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "FetchError";
    this.statusCode = statusCode;
  }
}

/** Check if error indicates rate limiting */
export function isRateLimitError(err) {
  const msg = err.message?.toLowerCase() || "";
  return (
    err.statusCode === 429 ||
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("limit")
  );
}
