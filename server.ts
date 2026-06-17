import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import JSZip from "jszip";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 1. AI Post Optimizer Endpoint using Gemini-3.5-flash
app.post("/api/gemini/optimize", async (req, res) => {
  try {
    const { content, tone = "professional" } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Missing content draft to optimize" });
    }

    const systemInstruction = `You are a social media optimization expert. Your task is to rewrite, refine, or summarize the user's input text to be highly engaging, and strictly fit within both X (280 characters max) and Bluesky (300 characters max) limits.
- Keep the length strictly below 275 characters so there is a safe margin.
- Retain essential hashtags and any URLs provided.
- Maintain a tone matching the user's selection: '${tone}'.
- Provide your optimized text directly inside the requested JSON response. Do not include markdown wraps or metadata outside the requested structure.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Draft: "${content}"\n\nPlease output the optimized post under 275 characters.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            optimizedText: {
              type: "string",
              description: "The refined, engaging text optimized to follow X and Bluesky character limits."
            },
            explanation: {
              type: "string",
              description: "Brief 1-sentence note of what adjustments were made (e.g., shortened, changed tone, removed prefix)."
            }
          },
          required: ["optimizedText", "explanation"]
        }
      }
    });

    const parsedResult = JSON.parse(response.text || "{}");
    res.json(parsedResult);
  } catch (error: any) {
    console.error("Gemini optimization failed:", error);
    res.status(500).json({ error: error.message || "Failed to optimize post with AI." });
  }
});

// 2. Real Bluesky ATP Social API Posting proxy route
app.post("/api/publish/bluesky", async (req, res) => {
  try {
    const { identifier, password, content } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Bluesky handle/email and App Password are required." });
    }
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Post content is empty." });
    }
    if (content.length > 300) {
      return res.status(400).json({ error: "Content exceeds Bluesky's 300 character limit." });
    }

    // A. Authenticate with ATP server to create session
    const sessionResponse = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    if (!sessionResponse.ok) {
      const errorData = await sessionResponse.json().catch(() => ({}));
      return res.status(sessionResponse.status).json({
        error: errorData.message || "Failed to authenticate with Bluesky. Verify your identifier and app password."
      });
    }

    const sessionData = await sessionResponse.json();
    const { accessJwt, did } = sessionData;

    // B. Publish record/skeet
    const postResponse = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessJwt}`
      },
      body: JSON.stringify({
        repo: did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text: content,
          createdAt: new Date().toISOString()
        }
      })
    });

    if (!postResponse.ok) {
      const postError = await postResponse.json().catch(() => ({}));
      return res.status(postResponse.status).json({
        error: postError.message || "Failed to create post on Bluesky."
      });
    }

    const postData = await postResponse.json();
    res.json({
      success: true,
      uri: postData.uri,
      cid: postData.cid,
      url: `https://bsky.app/profile/${identifier}/post/${postData.uri.split("/").pop()}`
    });
  } catch (error: any) {
    console.error("Bluesky posting failed:", error);
    res.status(500).json({ error: error.message || "Failed to publish to Bluesky." });
  }
});

// 3. Dynamic Chrome Extension ZIP Generator
app.get("/api/download-extension", async (req, res) => {
  try {
    const zip = new JSZip();

    // A. Create Extension Files
    const manifest = {
      manifest_version: 3,
      name: "X & Bluesky Cross-Publisher",
      version: "1.1",
      description: "Quickly share the active tab or post thoughts to both X and Bluesky with secure direct background API or zero-setup session intent modes.",
      permissions: ["storage", "activeTab"],
      action: {
        default_popup: "popup.html",
        default_icon: {
          "16": "icon.png",
          "48": "icon.png",
          "128": "icon.png"
        }
      }
    };

    const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cross Publisher</title>
  <style>
    body {
      width: 440px;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
    }
    .container {
      padding: 16px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 10px;
    }
    h1 {
      font-size: 15px;
      margin: 0;
      font-weight: 700;
      color: #1e293b;
    }
    .badge {
      font-size: 10px;
      background: #0284c7;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: bold;
    }
    .share-tab-container {
      margin-bottom: 10px;
    }
    .share-tab-btn {
      width: 100%;
      background-color: #f1f5f9;
      color: #0284c7;
      border: 1px dashed #0284c7;
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.2s;
    }
    .share-tab-btn:hover {
      background-color: #e0f2fe;
      color: #0369a1;
    }
    textarea {
      width: 100%;
      height: 120px;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      font-size: 13px;
      resize: none;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    textarea:focus {
      border-color: #0ea5e9;
    }
    .metrics {
      display: flex;
      gap: 12px;
      margin: 10px 0;
    }
    .metric-card {
      flex: 1;
      background: white;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .metric-title {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .metric-value {
      font-size: 14px;
      font-weight: 700;
    }
    .mode-select-container {
      background: #f1f5f9;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 12px;
      border: 1px solid #e2e8f0;
    }
    .mode-select-title {
      font-size: 11px;
      font-weight: bold;
      color: #475569;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }
    .radio-group {
      display: flex;
      gap: 12px;
    }
    .radio-label {
      font-size: 11px;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
    .publish-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .checkbox-row input {
      width: 15px;
      height: 15px;
    }
    button.primary-btn {
      background-color: #0f172a;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      transition: background-color 0.15s;
      width: 100%;
    }
    button.primary-btn:hover {
      background-color: #1e293b;
    }
    button.primary-btn:disabled {
      background-color: #cbd5e1;
      color: #94a3b8;
      cursor: not-allowed;
    }
    .secondary-btn {
      background-color: transparent;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      font-size: 12px;
    }
    .secondary-btn:hover {
      background-color: #f1f5f9;
    }
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .tab {
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      color: #64748b;
      border-bottom: 2px solid transparent;
    }
    .tab.active {
      color: #0ea5e9;
      border-bottom-color: #0ea5e9;
      font-weight: 600;
    }
    .pane {
      display: none;
    }
    .pane.active {
      display: block;
    }
    .input-group {
      margin-bottom: 10px;
    }
    .input-group label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 4px;
    }
    .input-group input {
      width: 100%;
      padding: 8px;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
    }
    .status-msg {
      margin-top: 8px;
      padding: 8px;
      border-radius: 6px;
      font-size: 11px;
      display: none;
    }
    .status-msg.info { display: block; background-color: #e0f2fe; color: #0369a1; }
    .status-msg.error { display: block; background-color: #fee2e2; color: #b91c1c; }
    .status-msg.success { display: block; background-color: #dcfce7; color: #15803d; }
    
    footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>X & Bluesky Cross-Publisher</h1>
      <span class="badge">V1.1</span>
    </header>

    <div class="share-tab-container">
      <button class="share-tab-btn" id="share-tab-btn">
        🔗 帶入目前瀏覽網頁的標題與連結
      </button>
    </div>

    <div class="tabs">
      <div class="tab active" id="tab-compose">編輯文章</div>
      <div class="tab" id="tab-settings">後台 API 密鑰設定</div>
    </div>

    <!-- Compose Pane -->
    <div class="pane active" id="pane-compose">
      <textarea id="editor" placeholder="輸入你想說的話，或點擊上方按鈕直接帶入當前分頁資訊..."></textarea>
      
      <div class="metrics">
        <div class="metric-card">
          <div class="metric-title">X 長度</div>
          <div class="metric-value" id="count-x" style="color: #10b981;">0 / 280</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">Bluesky 長度</div>
          <div class="metric-value" id="count-bsky" style="color: #10b981;">0 / 300</div>
        </div>
      </div>

      <div class="mode-select-container">
        <div class="mode-select-title">
          <span>運作發布模式</span>
          <span style="color:#0ea5e9;" id="mode-badge">⚡ 免帳密網頁 Session</span>
        </div>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="publish-mode" value="intent" checked id="radio-intent">
            免 API 網頁模式 (最推薦)
          </label>
          <label class="radio-label">
            <input type="radio" name="publish-mode" value="api" id="radio-api">
            背景靜默 API 模式
          </label>
        </div>
      </div>

      <div class="publish-section">
        <label class="checkbox-row">
          <input type="checkbox" id="check-x" checked> 同步發布至 X (Twitter)
        </label>
        <label class="checkbox-row">
          <input type="checkbox" id="check-bsky" checked> 同步發布至 Bluesky
        </label>

        <button class="primary-btn" id="pub-btn" style="margin-top: 6px;">
          🚀 一鍵同步發布
        </button>
      </div>
    </div>

    <!-- Settings Pane -->
    <div class="pane" id="pane-settings">
      <div style="border-bottom: 1px solid #cbd5e1; margin-bottom: 12px; padding-bottom: 8px;">
        <h3 style="font-size:12px; margin:0 0 8px 0; color:#1e293b;">Bluesky 後台靜默 API 資安設定</h3>
        <div class="status-msg info" style="display:block; margin:0 0 10px 0;">
          此設定<b>僅適用於「背景靜默 API 模式」</b>，系統會直接透過 ATP 後台為您發文。如果你使用免帳密之「網頁模式」，則不需填寫。
        </div>
        <div class="input-group">
          <label>帳號或 Email (例如: account.bsky.social)</label>
          <input type="text" id="bsky-handle" placeholder="username.bsky.social">
        </div>
        <div class="input-group">
          <label>App 密碼 (請到 Bluesky 設定 > App Passwords 生成)</label>
          <input type="password" id="bsky-pwd" placeholder="xxxx-xxxx-xxxx-xxxx">
        </div>
      </div>

      <div>
        <h3 style="font-size:12px; margin:0 0 4px 0; color:#1e293b;">X (Twitter) API 限制提示</h3>
        <div class="status-msg info" style="display:block; margin:0 0 10px 0; font-size:11px;">
          由於 X API 月費 extremely high，所有模式下同步 X 都會自動在另一分頁為您預載好文章草稿，點一下即可秒發，完美免除負擔並使用安全 Session。
        </div>
      </div>

      <button id="save-btn" class="secondary-btn" style="width:100%;">儲存帳密設定</button>
    </div>

    <div class="status-msg" id="status-box"></div>

    <footer>
      <span>Chrome Web Extension</span>
      <span id="saved-indicator" style="color: #0ea5e9;">✔ 免密碼 Mode OK</span>
    </footer>
  </div>

  <script src="popup.js"></script>
</body>
</html>`;

    // Popup logic with ATP Bluesky direct implementation & stored credentials
    const popupJs = `// Simple tab switcher
document.getElementById('tab-compose').addEventListener('click', () => {
  document.getElementById('tab-compose').classList.add('active');
  document.getElementById('tab-settings').classList.remove('active');
  document.getElementById('pane-compose').classList.add('active');
  document.getElementById('pane-settings').classList.remove('active');
});

document.getElementById('tab-settings').addEventListener('click', () => {
  document.getElementById('tab-settings').classList.add('active');
  document.getElementById('tab-compose').classList.remove('active');
  document.getElementById('pane-settings').classList.add('active');
  document.getElementById('pane-compose').classList.remove('active');
});

const editor = document.getElementById('editor');
const countX = document.getElementById('count-x');
const countBsky = document.getElementById('count-bsky');
const pubBtn = document.getElementById('pub-btn');
const statusBox = document.getElementById('status-box');
const modeBadge = document.getElementById('mode-badge');

// Radio buttons for mode
const radioIntent = document.getElementById('radio-intent');
const radioApi = document.getElementById('radio-api');

// Handle mode toggle UI and save pref
radioIntent.addEventListener('change', () => {
  if (radioIntent.checked) {
    modeBadge.textContent = '⚡ 免帳密網頁 Session';
    chrome.storage.local.set({ useApiMode: false });
  }
});

radioApi.addEventListener('change', () => {
  if (radioApi.checked) {
    modeBadge.textContent = '🔌 靜默 API 發文模式';
    chrome.storage.local.set({ useApiMode: true });
  }
});

// Quick Share current browser active tab! (帶入目前分頁)
document.getElementById('share-tab-btn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      const activeTab = tabs[0];
      const title = activeTab.title || '分享網頁';
      const url = activeTab.url || '';
      
      // Auto pre-fill content
      editor.value = \`\${title} \\n\${url}\`;
      updateMetrics();
      showStatus('已成功帶入當前網頁的標題與連結！', 'success');
    } else {
      showStatus('無法讀取當前網頁資訊。請確認您正在查看一個網頁分頁。', 'error');
    }
  });
});

// Character limits
const X_LIMIT = 280;
const BSKY_LIMIT = 300;

function calculateXLength(str) {
  const urlRegex = /(https?:\\/\\/[^\\s]+)/g;
  const urls = str.match(urlRegex) || [];
  let baseLength = str.replace(urlRegex, "").length;
  return baseLength + (urls.length * 23);
}

function updateMetrics() {
  const text = editor.value || '';
  const len = text.length;
  const xLen = calculateXLength(text);

  // X metric colors
  countX.textContent = \`\${xLen} / \${X_LIMIT}\`;
  if (xLen > X_LIMIT) {
    countX.style.color = '#ef4444'; 
  } else if (xLen > X_LIMIT - 20) {
    countX.style.color = '#f59e0b';
  } else {
    countX.style.color = '#10b981';
  }

  // Bluesky metric colors
  countBsky.textContent = \`\${len} / \${BSKY_LIMIT}\`;
  if (len > BSKY_LIMIT) {
    countBsky.style.color = '#ef4444';
  } else if (len > BSKY_LIMIT - 20) {
    countBsky.style.color = '#f59e0b';
  } else {
    countBsky.style.color = '#10b981';
  }

  // Disable publish if over the limits of chosen destinations
  const checkX = document.getElementById('check-x').checked;
  const checkBsky = document.getElementById('check-bsky').checked;
  
  const xOver = checkX && xLen > X_LIMIT;
  const bskyOver = checkBsky && len > BSKY_LIMIT;
  const noneChecked = !checkX && !checkBsky;

  pubBtn.disabled = xOver || bskyOver || noneChecked || len.trim === '';
}

editor.addEventListener('input', updateMetrics);
document.getElementById('check-x').addEventListener('change', updateMetrics);
document.getElementById('check-bsky').addEventListener('change', updateMetrics);

// Storage helper
function showStatus(text, type = 'info') {
  statusBox.textContent = text;
  statusBox.className = 'status-msg ' + type;
  setTimeout(() => {
    statusBox.style.display = 'none';
  }, 6000);
}

// Save credentials
document.getElementById('save-btn').addEventListener('click', () => {
  const handle = document.getElementById('bsky-handle').value.trim();
  const pwd = document.getElementById('bsky-pwd').value.trim();

  chrome.storage.local.set({ bskyHandle: handle, bskyPassword: pwd }, () => {
    showStatus('已儲存 Bluesky 背景 API 連線設定！', 'success');
    updateSavedIndicator();
  });
});

function updateSavedIndicator() {
  chrome.storage.local.get(['bskyHandle', 'bskyPassword', 'useApiMode'], (data) => {
    const indicator = document.getElementById('saved-indicator');
    
    // Restore mode
    if (data.useApiMode === true) {
      radioApi.checked = true;
      modeBadge.textContent = '🔌 靜默 API 發文模式';
    } else {
      radioIntent.checked = true;
      modeBadge.textContent = '⚡ 免帳密網頁 Session';
    }

    if (data.bskyHandle) {
      document.getElementById('bsky-handle').value = data.bskyHandle;
    }
    if (data.bskyPassword) {
      document.getElementById('bsky-pwd').value = data.bskyPassword;
    }

    if (data.bskyHandle && data.bskyPassword) {
      indicator.textContent = '✔ API 密鑰設定已完成';
      indicator.style.color = '#10b981';
    } else {
      indicator.textContent = '⚡ 免密碼網頁模式 Ready';
      indicator.style.color = '#0ea5e9';
    }
  });
}

// Run indicator count on start
updateSavedIndicator();
updateMetrics();

// Publish simultaneously handler
pubBtn.addEventListener('click', async () => {
  const text = editor.value.trim();
  const publishToX = document.getElementById('check-x').checked;
  const publishToBsky = document.getElementById('check-bsky').checked;
  const isApiModeSelected = radioApi.checked;

  pubBtn.disabled = true;
  pubBtn.textContent = '發布處理中...';

  let bskySuccess = false;
  let bskyErr = '';

  // 1. BLUESKY PUBLISHING
  if (publishToBsky) {
    if (isApiModeSelected) {
      // Direct API Posting Mode
      try {
        const data = await new Promise((resolve) => {
          chrome.storage.local.get(['bskyHandle', 'bskyPassword'], resolve);
        });

        if (!data.bskyHandle || !data.bskyPassword) {
          throw new Error('請到設定頁面填寫 Bluesky Handle 與 App Password，或切換為免密碼網頁模式。');
        }

        const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: data.bskyHandle, password: data.bskyPassword })
        });

        if (!sessionRes.ok) {
          const errorData = await sessionRes.json().catch(() => ({}));
          throw new Error(errorData.message || '認證失敗，請檢查 App 密碼是否正確。');
        }

        const session = await sessionRes.json();

        const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + session.accessJwt
          },
          body: JSON.stringify({
            repo: session.did,
            collection: "app.bsky.feed.post",
            record: {
              $type: "app.bsky.feed.post",
              text: text,
              createdAt: new Date().toISOString()
            }
          })
        });

        if (!postRes.ok) {
          const postErrorRes = await postRes.json().catch(() => ({}));
          throw new Error(postErrorRes.message || 'Bluesky 發布貼文失敗。');
        }

        bskySuccess = true;
      } catch (err) {
        bskySuccess = false;
        bskyErr = err.message;
      }
    } else {
      // ZERO-SETUP Session / Intent Mode (免帳密網頁模式)
      const bskyIntentUrl = "https://bsky.app/intent/compose?text=" + encodeURIComponent(text);
      chrome.tabs.create({ url: bskyIntentUrl });
      bskySuccess = true;
    }
  }

  // 2. X (TWITTER) INTENT REDIRECT (Universal for both sessions)
  if (publishToX) {
    const twitterUrl = "https://x.com/intent/tweet?text=" + encodeURIComponent(text);
    chrome.tabs.create({ url: twitterUrl });
  }

  // Present result status
  if (publishToBsky && publishToX) {
    if (isApiModeSelected) {
      if (bskySuccess) {
        showStatus('已於背景直接發布至 Bluesky！同時為您開啟了 X.com 的發文頁面。', 'success');
        editor.value = '';
        updateMetrics();
      } else {
        showStatus('X 頁面已開啟，但 Bluesky 背景發布失敗：' + bskyErr, 'error');
      }
    } else {
      showStatus('已成功為您同時挑起 X 以及 Bluesky 官方發文頁面，完美共享您的登入 Cookie / Session！', 'success');
      editor.value = '';
      updateMetrics();
    }
  } else if (publishToBsky) {
    if (isApiModeSelected) {
      if (bskySuccess) {
        showStatus('已順利在背景發佈至 Bluesky 帳號中！', 'success');
        editor.value = '';
        updateMetrics();
      } else {
        showStatus('Bluesky 背景發布出錯：' + bskyErr, 'error');
      }
    } else {
      showStatus('已開啟 Bluesky 網頁發布分頁，直接使用您的瀏覽器登入 Session！', 'success');
      editor.value = '';
      updateMetrics();
    }
  } else if (publishToX) {
    showStatus('已為您新開 X.com 發文視窗，內容已自動填妥！', 'success');
    editor.value = '';
    updateMetrics();
  }

  pubBtn.textContent = '🚀 一鍵同步發布';
  pubBtn.disabled = false;
});
`;

    // Pure standard logo PNG. We'll generate a canvas and write base64 buffer or we can offer a beautifully rendered canvas logo in ZIP!
    // Rather than dealing with binary canvas buffer loading on standard node, JSZip handles simple binary array, text, or we can save an icon code inside too!
    // Since images are required, we can generate a simple 1px png, or an SVG icon or even code as a plain text string representing an base64 png, or use canvas drawing in chrome popup.html!
    // To be perfectly bulletproof, we will let popup.html draw its icon dynamically on the menu or use a text-based SVG inside popup.html! That is super robust and requires zero binary file dependencies!
    // Wait, let's look at the manifest icon. Yes! In Manifest V3, we can omit custom default_icon entirely and just use default_title, or chrome will use the generic extension icon!
    // Or we can draw on canvas in background or generate a real PNG from a simple transparent base64 string.
    // Let's bundle a 1x1 base64 transparent PNG or small styled icon!
    const singlePixelPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADElEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const iconBuffer = Buffer.from(singlePixelPngBase64, 'base64');

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("popup.html", popupHtml);
    zip.file("popup.js", popupJs);
    zip.file("icon.png", iconBuffer);

    // Save instructions how to load the Extension
    const readme = `# X & Bluesky Cross-Publisher Chrome Extension

## How to install this extension in your Google Chrome browser:
1. Unzip the downloaded file "x-bluesky-cross-publisher-extension.zip" in a folder of your choice.
2. Open Google Chrome.
3. In the URL address bar, navigate to: **chrome://extensions**
4. Enable **Developer mode** (the switch at the top right of the extensions dashboard).
5. Click **Load unpacked** in the top-left corner.
6. Select the unzipped folder containing the files "manifest.json", "popup.html", and "popup.js".
7. Excellent! You now have a gorgeous floating Cross-Publisher right on your browser panel!
8. Click the Extensions puzzle piece icon, find "X & Bluesky Cross-Publisher" and pin it for quick access.

## Features:
- Compose posts under character limits.
- Save credentials locally inside your safe Chrome Storage.
- Send post directly to Bluesky (ATP endpoint).
- Opens Twitter Draft intent automatically to cross-post seamlessly on X Web.
`;

    zip.file("README.md", readme);

    // Generate zip binary
    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=x-bluesky-cross-publisher-extension.zip");
    res.send(content);

  } catch (error: any) {
    console.error("ZIP Generation failed:", error);
    res.status(500).json({ error: "Failed to assemble the chrome extension zip folder." });
  }
});


// Serve Vite or Static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
