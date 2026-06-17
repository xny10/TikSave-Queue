// TikSave Queue — Frontend Logic

const API_BASE = "";

// State
let currentJobId = null;
let currentJobData = null;
let currentItems = [];
let pollingTimer = null;
let isProcessing = false;

// DOM refs
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── Toast ────────────────────────────────────────
function showToast(msg, type = "info") {
  const existing = $(".toast");
  if (existing) existing.remove();
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ─── URL Validation & Count ──────────────────────
function validateAndCount() {
  const raw = $("#urlInput").value;
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const unique = [...new Set(lines)];
  const valid = unique.filter((url) => {
    try {
      const h = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
      return ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"].some(
        (d) => h === d || h.endsWith(`.${d}`)
      );
    } catch {
      return url.includes("tiktok.com");
    }
  });

  const dupes = lines.length - unique.length;
  const invalid = unique.length - valid.length;
  const total = valid.length;
  const overLimit = total > 10;

  $("#urlCount").textContent = `${total} valid URL${total !== 1 ? "s" : ""}`;
  $("#urlDetected").textContent = lines.length;
  $("#dupCount").textContent = dupes;

  $("#urlCount").className = `text-sm font-medium ${overLimit ? "text-red-400" : total > 0 ? "text-green-400" : "text-slate-500"}`;
  $("#submitBtn").disabled = total === 0 || total > 10 || isProcessing;

  if (overLimit) {
    $("#validationMsg").textContent = `Max 10 URLs allowed (${total} detected)`;
    $("#validationMsg").className = "text-xs text-red-400 mt-1";
  } else if (total > 0) {
    const dupMsg = dupes > 0 ? ` (${dupes} duplicate${dupes > 1 ? "s" : ""} removed)` : "";
    $("#validationMsg").textContent = `${total} URL${total !== 1 ? "s" : ""} ready to download${dupMsg}`;
    $("#validationMsg").className = "text-xs text-green-400 mt-1";
  } else if (lines.length > 0) {
    $("#validationMsg").textContent = "No valid TikTok URLs found";
    $("#validationMsg").className = "text-xs text-slate-500 mt-1";
  } else {
    $("#validationMsg").textContent = "";
  }
}

// ─── Submit Job ───────────────────────────────────
async function submitJob() {
  if (isProcessing) return;

  const raw = $("#urlInput").value;
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const unique = [...new Set(lines)];
  const valid = unique.filter((url) => {
    try {
      const h = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
      return ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"].some(
        (d) => h === d || h.endsWith(`.${d}`)
      );
    } catch {
      return url.includes("tiktok.com");
    }
  });

  if (valid.length === 0 || valid.length > 10) return;

  isProcessing = true;
  $("#submitBtn").disabled = true;
  $("#submitBtn").innerHTML =
    '<span class="inline-block animate-spin mr-2">⟳</span> Creating job...';

  try {
    const res = await fetch(`${API_BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: valid }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create job");
    }

    const data = await res.json();
    currentJobId = data.jobId;
    currentJobData = data.job;
    currentItems = data.items;

    $("#resultsSection").classList.remove("hidden");
    $("#resultsSection").classList.add("fade-in");

    updateStats(data.job.stats);
    renderQueueList(data.items);
    startPolling();

    showToast("Job created! Processing queue...", "success");
    $("#urlInput").value = "";
    validateAndCount();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    isProcessing = false;
    $("#submitBtn").disabled = false;
    $("#submitBtn").innerHTML =
      '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> Start Download';
  }
}

// ─── Polling ──────────────────────────────────────
function startPolling() {
  stopPolling();
  pollingTimer = setInterval(pollJob, 2000);
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

async function pollJob() {
  if (!currentJobId) return;

  try {
    const res = await fetch(`${API_BASE}/api/jobs/${currentJobId}`);
    if (!res.ok) return;

    const data = await res.json();
    currentJobData = data.job;
    currentItems = data.items;

    updateStats(data.job.stats);
    renderQueueList(data.items);

    // Stop polling if all done
    const allDone = data.items.every(
      (i) => i.status === "complete" || i.status === "failed" || i.status === "expired"
    );
    if (allDone) {
      stopPolling();
      showToast("All downloads processed!", "success");
    }
  } catch {
    // Silently retry
  }
}

// ─── Stats ────────────────────────────────────────
function updateStats(stats) {
  if (!stats) return;
  animateNumber("statTotal", stats.total || 0);
  animateNumber("statWaiting", stats.waiting || 0);
  animateNumber("statDownloading", stats.downloading || 0);
  animateNumber("statComplete", stats.complete || 0);
  animateNumber("statFailed", stats.failed || 0);

  const zipBtn = $("#zipBtn");
  if (stats.complete > 0) {
    zipBtn.classList.remove("opacity-50", "pointer-events-none");
  } else {
    zipBtn.classList.add("opacity-50", "pointer-events-none");
  }
}

function animateNumber(id, value) {
  const el = $(`#${id}`);
  if (el.textContent !== String(value)) {
    el.textContent = value;
    el.classList.remove("count-pop");
    void el.offsetWidth;
    el.classList.add("count-pop");
  }
}

// ─── Queue List ───────────────────────────────────
function renderQueueList(items) {
  const list = $("#queueList");
  if (!items.length) {
    list.innerHTML = '<div class="text-slate-500 text-sm text-center py-8">No items in queue</div>';
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
    <div class="glass queue-item fade-in" style="padding: 18px 22px; display: flex; align-items: center; gap: 16px; ${
      item.status === "downloading" ? "box-shadow: 0 0 20px rgba(96,165,250,0.15);" : ""
    }">
      <div style="flex-shrink: 0; width: 42px; height: 42px; border-radius: 12px; background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; color: #64748b;">
        ${item.index}
      </div>

      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span class="badge ${
            item.status === "waiting" ? "badge-waiting" :
            item.status === "provider_cooldown" ? "badge-cooldown" :
            item.status === "fetching_tikwm" ? "badge-fetching" :
            item.status === "downloading" ? "badge-downloading" :
            item.status === "complete" ? "badge-complete" :
            item.status === "failed" ? "badge-failed" :
            "badge-expired"
          }">${statusLabel(item.status)}</span>
          ${item.qualitySource ? `<span class="badge" style="background: rgba(34,211,238,0.12); color: #22d3ee; font-size: 0.65rem;">${item.qualitySource.toUpperCase()}</span>` : ""}
          ${item.resolution && item.status === "complete" ? `<span class="badge" style="background: rgba(139,92,246,0.12); color: #a78bfa; font-size: 0.65rem;">${item.resolution}</span>` : ""}
        </div>
        <div style="font-size: 0.875rem; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.url}">
          ${item.title || item.url}
        </div>
        ${item.author ? `<div style="font-size: 0.75rem; color: #64748b;">@${item.author}</div>` : ""}
        ${item.error ? `<div style="font-size: 0.7rem; color: #fca5a5; margin-top: 2px;">${item.error}</div>` : ""}
      </div>

      <div style="flex-shrink: 0;">
        ${item.status === "complete" ? `
          <button class="glass-btn glass-btn-download" style="padding: 8px 18px; font-size: 0.8rem;" onclick="downloadFile('${currentJobId}', '${item.id}')">
            <svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            MP4
          </button>
        ` : item.status === "downloading" ? `
          <div style="display: flex; align-items: center; gap: 6px; color: #60a5fa; font-size: 0.8rem;">
            <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="50" stroke-linecap="round" style="opacity: 0.3;"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style="opacity: 0.8;"/></svg>
            Downloading
          </div>
        ` : item.status === "failed" ? `
          <button class="glass-btn" style="padding: 8px 14px; font-size: 0.75rem;" onclick="retryItem('${currentJobId}', '${item.id}')">
            Retry
          </button>
        ` : `
          <span style="font-size: 0.75rem; color: #64748b;">${statusLabel(item.status)}</span>
        `}
      </div>
    </div>
  `
    )
    .join("\n");
}

function statusLabel(status) {
  const labels = {
    waiting: "Waiting",
    provider_cooldown: "Cooldown",
    fetching_tikwm: "Fetching",
    downloading: "Downloading",
    complete: "Complete",
    failed: "Failed",
    expired: "Expired",
  };
  return labels[status] || status;
}

// ─── Download Actions ─────────────────────────────
function downloadFile(jobId, itemId) {
  window.open(`${API_BASE}/api/files/${jobId}/${itemId}`, "_blank");
}

function downloadZip() {
  if (!currentJobId) return;
  window.open(`${API_BASE}/api/jobs/${currentJobId}/zip`, "_blank");
}

async function retryItem(jobId, itemId) {
  try {
    // Re-enqueue single item
    const itemsRaw = currentItems;
    const item = itemsRaw.find((i) => i.id === itemId);
    if (!item) return;

    const res = await fetch(`${API_BASE}/api/jobs/${jobId}/retry-failed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      showToast("Retrying failed items...", "info");
      startPolling();
    }
  } catch (err) {
    showToast("Retry failed", "error");
  }
}

async function retryAllFailed() {
  if (!currentJobId) return;
  try {
    const res = await fetch(`${API_BASE}/api/jobs/${currentJobId}/retry-failed`, {
      method: "POST",
    });
    if (res.ok) {
      showToast("Retrying all failed items...", "info");
      startPolling();
    }
  } catch {
    showToast("Retry failed", "error");
  }
}

// ─── Init ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  $("#urlInput").addEventListener("input", validateAndCount);
  $("#submitBtn").addEventListener("click", submitJob);
  $("#zipBtn").addEventListener("click", downloadZip);
  $("#retryFailedBtn").addEventListener("click", retryAllFailed);
});
