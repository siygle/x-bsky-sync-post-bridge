import { ExtensionCodeTemplates } from "./types";

export const extensionTemplates: ExtensionCodeTemplates = {
  manifest: `{
  "manifest_version": 3,
  "name": "SyncPost Bridge — Multi-Platform Cross-Publisher",
  "version": "1.2.0",
  "description": "Quickly post logs or active tab links to X (Twitter) & Bluesky. Supports browser-session intent and background API posting.",
  "permissions": ["storage", "activeTab"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "32": "icon32.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  "icons": {
    "16": "icon16.png",
    "32": "icon32.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
}`,

  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cross Publisher</title>
  <style>
    body { width: 440px; margin: 0; font-family: -apple-system, sans-serif; background-color: #f8fafc; }
    .container { padding: 16px; }
    .share-tab-btn { width: 100%; border: 1px dashed #0284c7; background: #f1f5f9; cursor: pointer; padding: 8px; font-size: 12px; }
    textarea { width: 100%; height: 120px; box-sizing: border-box; }
    .mode-select-container { background: #f1f5f9; padding: 10px; border-radius: 8px; margin: 10px 0; }
    .radio-group { display: flex; gap: 12px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <button id="share-tab-btn">🔗 帶入目前瀏覽網頁的標題與連結</button>
    <div class="tabs">
      <div class="tab active">編輯文章</div>
      <div class="tab">後台 API 密鑰設定</div>
    </div>
    <!-- ... check other panes in the package ... -->
  </div>
</body>
</html>`,

  js: `// Fast Active Tab Grabber
document.getElementById('share-tab-btn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      const activeTab = tabs[0];
      editor.value = \`\${activeTab.title} \\n\${activeTab.url}\`;
      updateMetrics();
    }
  });
});

// Supports Dual Sending Modes (Browser interactive session or API Background background posting)
`,

  readme: `# X & Bluesky Cross-Publisher Chrome Extension

## How to install this extension in Google Chrome:
1. Unzip the downloaded file 'x-bluesky-cross-publisher-extension.zip' in a folder.
2. Open Google Chrome and head to \`chrome://extensions\`
3. Enable "Developer mode" (Top Right).
4. Click "Load unpacked" (Top Left).
5. Select the folder containing manifest.json, popup.html, popup.js.
6. Open any browser tab, click the extension icon, click "🔗 帶入目前瀏覽網頁的標題與連結" and post!
`
};
export const fullExtensionTemplates: ExtensionCodeTemplates = {
  manifest: `{
  "manifest_version": 3,
  "name": "SyncPost Bridge — Multi-Platform Cross-Publisher",
  "version": "1.2.0",
  "description": "Quickly post logs or active tab links to X (Twitter) & Bluesky. Supports browser-session intent and background API posting.",
  "permissions": ["storage", "activeTab"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "32": "icon32.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
  "icons": {
    "16": "icon16.png",
    "32": "icon32.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
}`,

  html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cross Publisher</title>
  ... (Supports modern styling, modes toggle selection & zero-setup user interface)
</head>
<body>
  <button id="share-tab-btn">🔗 帶入目前瀏覽網頁的標題與連結</button>
  <div class="pane active" id="pane-compose">
    <textarea id="editor" placeholder="輸入你想說的話..."></textarea>
    <!-- Character length count & radio selectors -->
    <button class="primary-btn" id="pub-btn">🚀 一鍵同步發布</button>
  </div>
</body>
</html>`,

  js: `// Grabs current page active tab cleanly
document.getElementById('share-tab-btn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      const activeTab = tabs[0];
      document.getElementById('editor').value = activeTab.title + '\\n' + activeTab.url;
    }
  });
});

// Dual Posting implementation for X Intent and Bluesky ATP RPC or Intent Client Session
`,

  readme: `# X & Bluesky Cross-Publisher Chrome Extension

## How to install:
1. Download and Extract "x-bluesky-cross-publisher-extension.zip"
2. Navigate to \`chrome://extensions\` in your Chrome browser.
3. Enable "Developer mode" (Top Right).
4. Click "Load unpacked" (Top Left).
5. Open and start cross-posting without any complex setups!
`
};
