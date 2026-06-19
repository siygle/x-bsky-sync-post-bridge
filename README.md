# SyncPost Bridge — 跨平台同步發文神器 🚀
`SyncPost Bridge` 是一個專為 **X (Twitter)** 與 **Bluesky** 打造的跨平台同步發文神器！
它同時提供 **極簡網頁版儀表板** 與 **強大而便利的 Google Chrome 瀏覽器擴充功能 (Chrome Extension)**，幫助您在一瞬間將當前資訊、心得或網址分享到多個社群平台。

---

## 🌟 核心特色功能 (Extension Features)

### 1. 🔗 一鍵帶入當前分頁 (Quick Share Active Tab)
在安裝 Chrome 擴充功能後，當您正在瀏覽任何有趣的網頁（如新聞、論文、影片等）時，只要點擊擴充功能圖示，然後按下：
> **「🔗 帶入目前瀏覽網頁的標題與連結」**

系統就會**自動抓取您當前活動分頁 (Active Tab) 的網頁標題與 URL 連結**，並立即自動填入發文框，完美省去辛苦複製貼上的時間！
*(註：在 Local Web App 模式下，此按鈕會提供優雅的模擬帶入示範，並引導您下載實體擴充功能)*

### 2. ⚡ 雙軌發佈模式 (Dual Delivery Modes)
為了解除一般工具需要綁定高風險密碼的資安問題，SyncPost Bridge 創新提供兩種極致安全的運作模式：

*   **免帳密網頁模式 (Zero-Setup Intent Mode) —— 💡【最推薦】**
    *   **無資安顧慮**：完全不需於工具中輸入、儲存您的 Bluesky 密碼，亦不需任何 3rd-party API。
    *   **安全可信賴**：發佈時，系統會開啟兩邊官方的標準 Compose Intent Web 頁面，**直接沿用您瀏覽器現有的登入 Session (Cookie)**，完美兼顧安全，秒發草稿！
*   **背景靜默 API 模式 (Direct Background API Mode)**
    *   透過在設定面板輸入您的 Bluesky 帳號與安全防禦生成的 **App Password** (請勿填入主密碼)，擴充功能會在背景直接連線 ATP (Authenticated Transfer Protocol) RPC 端點，完成秒速直接發文。

### 3. 📊 即時字數驗證與連結優化
*   **X (Twitter)**：支援 `24` 小時即時 Twitter 字數極限監控 (包含網址自動縮短為 $23$ 字元的精準算法)。
*   **Bluesky**：支援 $300$ 字元即時更新計算。
*   當超出字數上限時，發佈按鈕將自動防呆鎖定，避免發文失敗。

### 4. 🤖 內置 AI 生成發文改寫 (Gemini AI Companion)
*   本地 Web App 同步提供 **Gemini AI 優化改寫小幫手**。
*   能將原本生硬的連結標題與文字，一鍵升級為吸引人的社群行銷貼文 (可選：幽默風趣、科技極簡、專業分析等風格)。

---

## 🛠️ Chrome 擴充功能安裝步驟

1.  **下載擴充套件 ZIP 檔**：在網頁介面右上角點擊 **「📥 下載 Chrome 擴充功能 ZIP」**，或直接解壓 `/dist` 的產出物。
2.  **解壓縮檔案**：將下載得到的 `x-bluesky-cross-publisher-extension.zip` 解壓縮到一個獨立的資料夾中。
3.  **前往擴充功能頁面**：開啟 Google Chrome 瀏覽器，在網址列中輸入並前往 `chrome://extensions`。
4.  **啟用開發者模式**：將頁面右上角的 **「開發者模式 (Developer mode)」** 開關切換為啟用（開啟狀態）。
5.  **載入未打包擴充功能**：點擊左上角的 **「載入未打包 (Load unpacked)」** 按鈕。
6.  **選取資料夾**：選取剛才第 2 步解壓縮出來的完整資料夾（內含 `manifest.json`、`popup.html` 和 `popup.js` 檔案）。
7.  **釘選快速啟用**：點擊 Chrome 工具列右上角的「拼圖」圖示，找到 **X & Bluesky Cross-Publisher** 並點選「釘選（留置）」按鈕，即可享受一鍵分享之流暢體驗！

---

## 📂 專案檔案結構
*   `README.md` (本文件) — 系統擴充特色、商店上架指引與操作指南。
*   `server.ts` — 用於本機/雲端運行之 Express Web 伺服器，同時兼顧動態 ZIP 打包下載端點與 Bluesky ATP API Proxy 代發邏輯。
*   `src/App.tsx` — 具有高度科技動感、高對比、排版卓越細緻之 Web Dashboard，包含擴充代碼編輯器、日誌儀表、AI 改寫及直接下載按鈕。
*   `src/extensionTemplates.ts` — 儲存了擴充套件所需 manifest、html、js 完美對其繁體中文、帶入目前網頁網址及雙軌 Session 發佈模式的原始碼範本。

---

## 🌐 Chrome Web Store 上架發布指南 (Chrome Web Store Publishing Guide)
如果您希望將此擴充功能發佈至 Chrome 線上應用程式商店，以下是我們為您調校好的上架步驟與資安審查指引：

1. **打包 ZIP 檔**：點擊網頁介面右上角 **「📥 下載 Chrome 擴充功能 ZIP」**，取得已封裝好的 `x-bluesky-cross-publisher-extension.zip`。
2. **註冊開發者帳號**：前往 [Chrome 線上應用程式商店開發者主控台](https://chrome.google.com/webstore/devconsole) 登入您的 Google 帳號並支付一次性 5 美元註冊費。
3. **上傳擴充套件**：
   * 點擊右側的 **「新增項目 (Add new item)」**，選擇下載好的 ZIP 檔案並上傳。
4. **填寫詳細資訊 (Store Listing)**：
   * **高質感套件圖示 (Store Icon)**：在下載包中已完美預置 `icon16.png`、`icon32.png`、`icon48.png` 以及 `icon128.png` 的 **精美 3D 微立體藍色多平台同步發文標識**，不需再做任何修改，上傳即直接顯示。
   * **螢幕截圖**：提供 1 至 5 張擴充套件 Popup 小窗以及本 Web Dashboard 搭配運作的精緻操作截圖（推薦尺寸 1280x800 px 或 640x400 px）。
   * **宣傳圖 (Promo Tile)**：準備一張 440x280 px 的主風格特色宣傳圖。
5. **極佳的資安與最速過審優勢 (Privacy & Fast Review Permissions)**：
   * **極簡安全權限**：本擴充套件僅申請最安全的兩個權限：
     - `storage`：僅用於在本機 Chrome Sandbox 沙盒儲存您自選的預設發佈管道（X/Bluesky）與發文草稿狀態。
     - `activeTab`：僅在您「主動點擊」帶入按鈕時，暫時安全讀取當前標籤的 Title 與 URL。
   * **秒速審核通過**：本套件**並未申請**會跳出警告視窗的廣義 `tabs` 讀取權限，亦**未申請**背景腳本攔截或注入（Content Scripts），這使它具有極高的資安安全係數，**極大縮短了 Google 官方的資安人工審閱流程，絕大多能於 12 - 48 小時內自动安全無痛過審並公開上架！**

---

## 🔒 隱私與資安承諾
*   **100% 隱私保護**：即便您使用「背景 API 模式」，您的 App 口令密鑰亦只會儲存在本機瀏覽器的 `chrome.storage.local` 沙盒內，絕不上傳到第三方的雲端伺服器，完全安全有保障。
*   **極力推廣 Intent 模式**：強烈建議使用「免帳密網頁模式」，利用平台的 Session 將不留一絲資安隱憂。
