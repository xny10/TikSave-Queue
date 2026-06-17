import { writeFileSync } from "fs";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="TikSave Queue — Bulk TikTok video downloader with auto highest quality via TikWM. Free, no API key needed.">
  <title>TikSave Queue — TikTok Bulk Downloader</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css">
  <style>
    .hidden { display: none !important; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin { animation: spin 1s linear infinite; }
    .opacity-50 { opacity: 0.5; }
    .pointer-events-none { pointer-events: none; }
  </style>
</head>
<body>
  <div class="bg-orbs">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
  </div>

  <main style="position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 32px 20px 80px;">

    <!-- Header -->
    <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; padding: 18px 24px;" class="glass">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #8b5cf6, #22d3ee); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">⬇</div>
        <div>
          <h1 style="font-size: 1.25rem; font-weight: 700; color: white; margin: 0;">TikSave Queue</h1>
          <p style="font-size: 0.7rem; color: #64748b; margin: 0;">TikWM Provider</p>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="online-dot"></div>
        <span style="font-size: 0.75rem; color: #22c55e; font-weight: 600;">Online</span>
      </div>
    </header>

    <!-- Hero -->
    <section style="text-align: center; margin-bottom: 32px;">
      <h2 class="gradient-text hero-title" style="font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 800; margin-bottom: 12px;">
        Bulk TikTok Downloader
      </h2>
      <p style="font-size: 0.95rem; color: #94a3b8; max-width: 600px; margin: 0 auto 8px;">
        Auto highest quality via TikWM • Global safe queue • Auto delete 10 minutes
      </p>
      <p style="font-size: 0.75rem; color: #475569;">
        Downloads are processed in a global safe queue to keep requests stable.<br>
        Files are temporary and will be deleted after 10 minutes.
      </p>
    </section>

    <!-- Input Card -->
    <section class="glass" style="padding: 28px; margin-bottom: 24px;" id="inputCard">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 1rem; font-weight: 600; color: #e2e8f0;">Paste TikTok URLs</h3>
        <div style="display: flex; gap: 16px; font-size: 0.75rem; color: #64748b;">
          <span>Detected: <b id="urlDetected" style="color: #cbd5e1;">0</b></span>
          <span>Duplicates: <b id="dupCount" style="color: #facc15;">0</b></span>
          <span>Valid: <b id="urlCount" style="color: #22c55e;">0</b><span style="color: #64748b;">/10</span></span>
        </div>
      </div>

      <textarea
        id="urlInput"
        class="glass-input"
        placeholder="https://www.tiktok.com/@user/video/123456&#10;https://vm.tiktok.com/abc123/&#10;https://vt.tiktok.com/def456/&#10;&#10;One URL per line. Max 10 URLs. Duplicates auto-removed."
        style="width: 100%; min-height: 140px; padding: 18px; font-size: 0.85rem; line-height: 1.6;"
      ></textarea>

      <div id="validationMsg" style="margin-top: 8px;"></div>

      <button id="submitBtn" class="glass-btn" disabled style="width: 100%; padding: 16px; font-size: 0.95rem; margin-top: 16px;">
        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
        Start Download
      </button>
    </section>

    <!-- Results Section -->
    <section id="resultsSection" class="hidden">
      <!-- Stats -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px;">
        <div class="glass" style="padding: 16px; text-align: center;">
          <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Total</div>
          <div id="statTotal" style="font-size: 1.5rem; font-weight: 700; color: #e2e8f0;">0</div>
        </div>
        <div class="glass" style="padding: 16px; text-align: center;">
          <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Waiting</div>
          <div id="statWaiting" style="font-size: 1.5rem; font-weight: 700; color: #94a3b8;">0</div>
        </div>
        <div class="glass" style="padding: 16px; text-align: center;">
          <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Downloading</div>
          <div id="statDownloading" style="font-size: 1.5rem; font-weight: 700; color: #60a5fa;">0</div>
        </div>
        <div class="glass" style="padding: 16px; text-align: center;">
          <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Complete</div>
          <div id="statComplete" style="font-size: 1.5rem; font-weight: 700; color: #22c55e;">0</div>
        </div>
        <div class="glass" style="padding: 16px; text-align: center;">
          <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Failed</div>
          <div id="statFailed" style="font-size: 1.5rem; font-weight: 700; color: #ef4444;">0</div>
        </div>
      </div>

      <!-- Queue Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 1rem; font-weight: 600; color: #e2e8f0;">Download Queue</h3>
        <button id="retryFailedBtn" class="glass-btn" style="padding: 8px 16px; font-size: 0.75rem;">
          Retry Failed
        </button>
      </div>

      <!-- Queue List -->
      <div id="queueList" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;">
        <div class="text-slate-500 text-sm text-center py-8">No items in queue</div>
      </div>

      <!-- Footer Actions -->
      <div style="display: flex; justify-content: center; margin-bottom: 16px;">
        <button id="zipBtn" class="glass-btn glass-btn-zip opacity-50 pointer-events-none">
          <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Download All as ZIP
        </button>
      </div>

      <p style="text-align: center; font-size: 0.7rem; color: #475569;">
        Files are temporary and will be deleted after 10 minutes.
      </p>
    </section>
  </main>

  <script src="/app.js"></script>
</body>
</html>`;

writeFileSync("public/index.html", html, "utf-8");
console.log("HTML written:", html.length, "bytes");
