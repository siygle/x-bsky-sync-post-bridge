import { useState, useEffect, useCallback } from "react";
import { 
  Send, Sparkles, Download, Twitter, Cloud, Check, Loader2, Info, 
  Settings, Code, FileText, ExternalLink, AlertCircle, Trash2, 
  Eye, EyeOff, Lock, Play, Copy, RefreshCw 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BlueskyCredentials, PostDraft, LogEntry, ExtensionFile } from "./types";
import { fullExtensionTemplates } from "./extensionTemplates";

export default function App() {
  // Post states
  const [text, setText] = useState<string>("");
  const [publishToX, setPublishToX] = useState<boolean>(true);
  const [publishToBsky, setPublishToBsky] = useState<boolean>(true);
  const [publishMode, setPublishMode] = useState<"intent" | "api">("intent");

  // AI states
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [aiTone, setAiTone] = useState<string>("professional");
  const [optResult, setOptResult] = useState<{ optimizedText: string; explanation: string } | null>(null);

  // Credentials (persist to localStorage so the user can test for real on Bluesky!)
  const [bskyCreds, setBskyCreds] = useState<BlueskyCredentials>(() => {
    const saved = localStorage.getItem("bsky_creds");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return { handle: "", appPassword: "" };
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Action status/logs
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "init",
      timestamp: new Date().toLocaleTimeString(),
      type: "info",
      network: "System",
      message: "Publisher Workspace loaded. Define credentials or draft your post to get started."
    }
  ]);

  // Code review section states
  const [activeFile, setActiveFile] = useState<ExtensionFile>("manifest.json");
  const [copiedFile, setCopiedFile] = useState<boolean>(false);

  // Save credentials to localStorage
  const saveCredentials = (creds: BlueskyCredentials) => {
    localStorage.setItem("bsky_creds", JSON.stringify(creds));
    setBskyCreds(creds);
    addLog("System", "success", "Bluesky credentials updated and saved locally in secure storage.");
  };

  // Helper log function
  const addLog = (network: "X" | "Bluesky" | "AI" | "System", type: "success" | "error" | "info", message: string, link?: string) => {
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        type,
        network,
        message,
        link
      },
      ...prev
    ]);
  };

  // Character counting rules
  // X: URLs always count as exactly 23 characters (t.co format)
  // Bluesky: URLs count as their literal length in standard char length.
  const calculateXLength = (str: string): number => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = str.match(urlRegex) || [];
    let baseLength = str.replace(urlRegex, "").length;
    return baseLength + (urls.length * 23);
  };

  const xLength = calculateXLength(text);
  const bskyLength = text.length;

  const X_LIMIT = 280;
  const BSKY_LIMIT = 300;

  // Append short clips or elements for quick crafting
  const appendText = (addition: string) => {
    setText((prev) => {
      const space = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
      return prev + space + addition;
    });
  };

  // Clear workspace
  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear your current draft?")) {
      setText("");
      setOptResult(null);
    }
  };

  // AI content optimizer using Gemini endpoint
  const handleAiOptimize = async () => {
    if (!text.trim()) {
      alert("Please enter a text draft first for the AI to optimize!");
      return;
    }
    setIsOptimizing(true);
    setOptResult(null);
    addLog("AI", "info", `Asking AI to optimize post with a '${aiTone}' tone for X & Bluesky compatibility...`);

    try {
      const res = await fetch("/api/gemini/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, tone: aiTone }),
      });

      if (!res.ok) {
        throw new Error("Backend AI endpoint returned an error");
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setOptResult(data);
      addLog("AI", "success", "AI Suggested an optimized draft: " + data.explanation);
    } catch (error: any) {
      console.error(error);
      addLog("AI", "error", `AI Optimization failed: ${error.message || "Something went wrong"}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Accept AI suggestion
  const handleAcceptSuggestion = () => {
    if (optResult) {
      setText(optResult.optimizedText);
      setOptResult(null);
      addLog("System", "success", "AI optimized post draft successfully applied to editor.");
    }
  };

  // Quick Share tab in the web page dashboard
  const handleQuickShareCurrentTab = () => {
    const simulatedTitle = document.title || "SyncPost Bridge — 跨平台同步發文神器";
    const simulatedUrl = window.location.origin || "https://ais-pre-cyigsyujlorxslbyfgbl7d-514634992343.asia-northeast1.run.app";
    setText(`${simulatedTitle}\n${simulatedUrl}`);
    addLog("System", "success", "【模擬帶入】已在此網頁版中「模擬帶入」當前網頁資訊。提醒：當您下載、解壓並安裝 Chrome 擴充功能後，此功能會動態讀取您當時正在瀏覽之『任意網站分頁的標題與連結』！");
  };

  // Trigger real or simulated simultaneous publishing
  const handlePublish = async () => {
    if (!text.trim()) {
      alert("Composing content is empty!");
      return;
    }

    setIsPublishing(true);
    addLog("System", "info", `Initiating cross-publishing flow using ${publishMode === "intent" ? "Zero-Setup Intent Web Session" : "Direct Background API Connection"}...`);

    // 1. Publishing to Bluesky
    if (publishToBsky) {
      if (publishMode === "api") {
        if (!bskyCreds.handle || !bskyCreds.appPassword) {
          addLog("Bluesky", "error", "Missing handle or App Password. Configure them on the credentials panel!");
        } else {
          addLog("Bluesky", "info", `Connecting to Bluesky API and sending content of ${bskyLength} characters...`);
          try {
            const bskyRes = await fetch("/api/publish/bluesky", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                identifier: bskyCreds.handle,
                password: bskyCreds.appPassword,
                content: text
              })
            });

            const bskyResult = await bskyRes.json();
            if (bskyRes.ok && bskyResult.success) {
              addLog("Bluesky", "success", "Skeet successfully published directly to Bluesky API!", bskyResult.url);
            } else {
              throw new Error(bskyResult.error || "Bluesky network rejected post.");
            }
          } catch (err: any) {
            addLog("Bluesky", "error", `Bluesky API publishing failed: ${err.message}`);
          }
        }
      } else {
        // Zero-API Web Intent Mode
        addLog("Bluesky", "info", "Launching official Bluesky Web Intent composer (100% secure, zero requirements for app passwords or handler setups, perfectly using your browser login cookies/session)...");
        const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
        window.open(bskyUrl, "_blank");
        addLog("Bluesky", "success", "Draft context transferred to standard Bluesky Web Composer.");
      }
    }

    // 2. Publishing to X (Twitter) Web Fallback Composer
    if (publishToX) {
      addLog("X", "info", "Launching official tweet composer redirect (the safest, most reliable way to post to X without expensive API tiers)...");
      const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(twitterUrl, "_blank");
      addLog("X", "success", "Draft context transferred to standard X Web Composer.");
    }

    setIsPublishing(false);
  };

  // Dynamic file content download of zipped extension
  const handleDownloadZip = () => {
    addLog("System", "info", "Assembling and bundling Google Chrome Extension files as ZIP...");
    window.location.href = "/api/download-extension";
  };

  // Copy active template code
  const copyTemplate = () => {
    let contentToWrite = "";
    if (activeFile === "manifest.json") contentToWrite = fullExtensionTemplates.manifest;
    else if (activeFile === "popup.html") contentToWrite = fullExtensionTemplates.html;
    else if (activeFile === "popup.js") contentToWrite = fullExtensionTemplates.js;
    else if (activeFile === "README.md") contentToWrite = fullExtensionTemplates.readme;

    navigator.clipboard.writeText(contentToWrite);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-sky-200">
      {/* Upper Navigation Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-sky-600 text-white p-2 rounded-xl shadow-md shadow-sky-200">
              <RefreshCw className="h-6 w-6 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center">
                SyncPost Bridge
                <span className="ml-2 px-2 py-0.5 text-xs bg-sky-100 text-sky-800 rounded-full font-semibold">
                  Web & Extension
                </span>
              </h1>
              <p className="text-xs text-slate-500">Cross-Publish seamless posts directly to X & Bluesky</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadZip}
              className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center space-x-2 cursor-pointer group"
              id="header-btn-download"
            >
              <Download className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" />
              <span>Download Chrome Extension (.zip)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Help Banner */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start space-x-3 shadow-xs">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <span className="font-semibold block mb-0.5">Dual-Platform Strategy:</span>
            We provide a <strong>two-in-one platform</strong>. Compose, preview, and test API publishes right here on this interactive web dashboard, and when ready, click <strong>Download Chrome Extension</strong> to pack these exact operational capabilities into a real floating Chrome plugin you can run inside your browser.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: Composition Workspace (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* The Main Editor Box */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" id="workspace-card">
              <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 flex items-center space-x-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Interactive Editor</span>
                </span>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => appendText("https://")}
                    className="text-xs text-slate-500 hover:text-sky-600 bg-slate-100/80 hover:bg-sky-50 px-2.5 py-1 rounded-md transition-colors"
                  >
                    + Add Link
                  </button>
                  <button 
                    onClick={() => appendText("#CrossPost")}
                    className="text-xs text-slate-500 hover:text-sky-600 bg-slate-100/80 hover:bg-sky-50 px-2.5 py-1 rounded-md transition-colors"
                  >
                    + #CrossPost
                  </button>
                  {text && (
                    <button
                      onClick={handleClear}
                      className="text-xs text-rose-500 hover:bg-rose-50 px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Tab share button */}
              <div className="px-5 pt-4">
                <button
                  type="button"
                  onClick={handleQuickShareCurrentTab}
                  className="w-full bg-sky-50/50 hover:bg-sky-100/50 text-sky-700 hover:text-sky-800 border border-dashed border-sky-300 rounded-xl py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer shadow-xs"
                >
                  <span className="text-base">🔗</span>
                  <span>帶入目前瀏覽網頁的標題與連結</span>
                </button>
              </div>

              <div className="p-5">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="在此輸入或編輯您的社群發文草稿，字數上限將即時更新。您亦可使用下方的 Gemini AI 發文優化助理..."
                  className="w-full min-h-[160px] text-slate-800 placeholder-slate-400 text-base border-0 focus:ring-0 resize-none outline-none bg-slate-50/20 p-3 rounded-xl border border-slate-100"
                  id="draft-textarea"
                />

                {/* Operational Platform Mode Selector */}
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">選擇運作發布模式</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold select-none ${
                      publishMode === "intent" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                    }`}>
                      {publishMode === "intent" ? "⚡ 免帳密網頁 Session 模式" : "🔌 後台直連 API 模式"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex-1 flex items-start p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50/50 transition-colors">
                      <input 
                        type="radio" 
                        name="post-delivery-mode" 
                        value="intent" 
                        checked={publishMode === "intent"}
                        onChange={() => setPublishMode("intent")}
                        className="mt-0.5 mr-2 text-sky-600 focus:ring-sky-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">免 API 網頁模式 (最推薦)</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">免配 App 密碼、免 API 金鑰！一鍵呼叫官方發文頁並沿用現有登入 Cokies，無資安疑慮且零負擔。</span>
                      </div>
                    </label>

                    <label className="flex-1 flex items-start p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50/50 transition-colors">
                      <input 
                        type="radio" 
                        name="post-delivery-mode" 
                        value="api" 
                        checked={publishMode === "api"}
                        onChange={() => setPublishMode("api")}
                        className="mt-0.5 mr-2 text-sky-600 focus:ring-sky-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">背景直連 API 模式</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">需要在設定面板輸入您的 Bluesky Handle 與 App Passwords，系統將透過背景 API 靜默發布貼文。</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Character Counter Progress Indicators */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                  {/* X Meter */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-600 flex items-center space-x-1">
                        <Twitter className="h-3.5 w-3.5 text-slate-900 fill-slate-900" />
                        <span>X (Twitter) Length</span>
                      </span>
                      <span className={`font-mono font-medium ${xLength > X_LIMIT ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                        {xLength} / {X_LIMIT}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-200 ${
                          xLength > X_LIMIT ? "bg-rose-500" : xLength > X_LIMIT - 30 ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min((xLength / X_LIMIT) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Bluesky Meter */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-600 flex items-center space-x-1">
                        <Cloud className="h-3.5 w-3.5 text-sky-500" />
                        <span>Bluesky Length</span>
                      </span>
                      <span className={`font-mono font-medium ${bskyLength > BSKY_LIMIT ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                        {bskyLength} / {BSKY_LIMIT}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-200 ${
                          bskyLength > BSKY_LIMIT ? "bg-rose-500" : bskyLength > BSKY_LIMIT - 30 ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min((bskyLength / BSKY_LIMIT) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Core Publish Action Footer */}
              <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                    <input 
                      type="checkbox" 
                      checked={publishToX} 
                      onChange={(e) => setPublishToX(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                    />
                    <Twitter className="h-3.5 w-3.5 text-slate-900 fill-slate-900" />
                    <span>Include X</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                    <input 
                      type="checkbox" 
                      checked={publishToBsky} 
                      onChange={(e) => setPublishToBsky(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                    />
                    <Cloud className="h-3.5 w-3.5 text-sky-500" />
                    <span>Include Bluesky</span>
                  </label>
                </div>

                <div className="flex space-x-2">
                  <button
                    disabled={
                      isPublishing || 
                      !text.trim() || 
                      (!publishToX && !publishToBsky) ||
                      (publishToX && xLength > X_LIMIT) ||
                      (publishToBsky && bskyLength > BSKY_LIMIT)
                    }
                    onClick={handlePublish}
                    className="flex-1 sm:flex-none justify-center bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-5 rounded-lg flex items-center space-x-2 transition-colors cursor-pointer"
                    id="btn-publish-workspace"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Publish Simultaneously</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* AI Assistant Optimization Card (Gemini 3.5 Flash) */}
            <div className="bg-gradient-to-br from-indigo-50 to-sky-50 rounded-xl border border-indigo-100 shadow-xs p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Sparkles className="h-24 w-24 text-indigo-600" />
              </div>

              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Gemini AI Copywriting Optimizer</h3>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Need to condense your thoughts or change how you present them? Choose a dynamic persona and let our system-integrated Gemini model rewrite your post to fit perfectly in both character constraints.
              </p>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs font-semibold text-slate-500 mr-1">Tone style:</span>
                {["professional", "casual", "engaging", "concise"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setAiTone(t)}
                    className={`text-xs px-3 py-1.5 rounded-full capitalize border transition-all duration-150 cursor-pointer ${
                      aiTone === t 
                        ? "bg-indigo-600 text-white border-indigo-600 font-medium" 
                        : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    {t === "concise" ? "⚡ Strict Shorten" : t}
                  </button>
                ))}
              </div>

              <div className="flex space-x-2">
                <button
                  disabled={isOptimizing || !text.trim()}
                  onClick={handleAiOptimize}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
                  id="btn-ai-optimize"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Optimizing with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>AI Optimize Draft</span>
                    </>
                  )}
                </button>
              </div>

              {/* AI Suggestion Content Block */}
              <AnimatePresence>
                {optResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    className="mt-5 bg-white border border-indigo-100 rounded-xl p-4 shadow-sm space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider block">
                          AI Suggestion
                        </span>
                        <span className="text-xs text-slate-400 italic block mt-0.5">
                          "{optResult.explanation}"
                        </span>
                      </div>
                      <div className="flex space-x-1.5">
                        <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {calculateXLength(optResult.optimizedText)} chars (X)
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg text-sm text-slate-800 leading-relaxed font-sans select-all whitespace-pre-wrap">
                      {optResult.optimizedText}
                    </div>

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        onClick={() => setOptResult(null)}
                        className="text-xs text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        onClick={handleAcceptSuggestion}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors shadow-sm cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Accept & Replace Draft</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Secure Credentials Setup Panel */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
                <Settings className="h-5 w-5 text-slate-600" />
                <h3 className="text-base font-bold text-slate-900">Credential configuration (Safe, Local Storage)</h3>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 space-y-1">
                  <strong>ℹ Local Privacy Guarantee:</strong> Your credentials are saved inside your individual browser instance and never persistent on any third-party clouds.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Bluesky Handle / Email</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="yourname.bsky.social"
                        value={bskyCreds.handle}
                        onChange={(e) => setBskyCreds({ ...bskyCreds, handle: e.target.value.trim() })}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-none focus:ring-1 focus:ring-sky-600 block"
                        id="input-bsky-handle"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                      <span>Bluesky App Password</span>
                      <a 
                        href="https://bsky.app/settings/app-passwords" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-sky-600 hover:underline flex items-center"
                      >
                        Create App Password <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                      </a>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="xxxx-xxxx-xxxx-xxxx"
                        value={bskyCreds.appPassword}
                        onChange={(e) => setBskyCreds({ ...bskyCreds, appPassword: e.target.value.trim() })}
                        className="w-full text-xs pl-3 pr-10 py-2 border border-slate-300 rounded-lg shadow-xs focus:outline-none focus:ring-1 focus:ring-sky-600 block"
                        id="input-bsky-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => saveCredentials(bskyCreds)}
                    className="bg-slate-100 dark:hover:bg-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-4 rounded-lg transition-colors border border-slate-300 cursor-pointer"
                    id="btn-save-creds"
                  >
                    Save Credentials Locally
                  </button>
                </div>
              </div>
            </div>

            {/* Operational Logs Terminal */}
            <div className="bg-slate-900 rounded-xl shadow-md border border-slate-800 overflow-hidden">
              <div className="bg-slate-950 px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
                <span className="text-xs font-bold text-slate-400 font-mono flex items-center">
                  <Play className="h-3.5 w-3.5 mr-1.5 text-sky-400" />
                  Terminal Logging output
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  REAL-TIME ACTIONS
                </span>
              </div>
              <div className="p-4 font-mono text-xs text-slate-300 min-h-[140px] max-h-[220px] overflow-y-auto space-y-2">
                {logs.length === 0 ? (
                  <div className="text-slate-500 text-center italic">No terminal logs executed in this session.</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-1.5 leading-relaxed">
                      <span className="text-slate-500 shrink-0 font-medium select-none">{log.timestamp}</span>
                      <span className={`px-1 rounded text-[10px] uppercase font-bold shrink-0 ${
                        log.type === "success" 
                          ? "bg-emerald-950 text-emerald-400" 
                          : log.type === "error" 
                          ? "bg-rose-950 text-rose-400" 
                          : "bg-blue-950 text-blue-400"
                      }`}>
                        {log.network}
                      </span>
                      <div className="flex-1 text-slate-100">
                        {log.message}
                        {log.link && (
                          <a 
                            href={log.link} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center ml-1 text-sky-400 hover:underline"
                          >
                            <span>[View Post]</span>
                            <ExternalLink className="h-3 w-3 ml-0.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: Live Preview Feed Mock (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Visual Header */}
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                High-Fidelity Post Feed Previews
              </h3>
              <p className="text-xs text-slate-500">
                Instantly visualize how your text draft looks when translated onto both social networks. Characters following the limits are gracefully highlighted.
              </p>
            </div>

            {/* MOCK: Twitter (X) Card */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Twitter className="h-3.5 w-3.5 text-slate-900 fill-slate-900" />
                  <span>X (Twitter) Feed Preview</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded">
                  Max 280
                </span>
              </div>

              {/* Twitter Post Detail Card Body */}
              <div className="p-4 font-sans">
                <div className="flex items-start space-x-3">
                  <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0 overflow-hidden select-none flex items-center justify-center font-bold text-slate-600 bg-gradient-to-tr from-sky-400 to-indigo-500 text-white">
                    JD
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-1 text-sm">
                      <span className="font-extrabold text-slate-900">John Doe</span>
                      <span className="text-slate-500 font-normal">@johndoe</span>
                      <span className="text-slate-400 select-none">·</span>
                      <span className="text-slate-500 hover:underline cursor-pointer">1m</span>
                    </div>

                    <div className="text-sm text-slate-900 leading-normal break-words whitespace-pre-wrap">
                      {text.length === 0 ? (
                        <span className="text-slate-400 italic">No content composed. Begin typing in the editor on the left to preview...</span>
                      ) : (
                        renderPreviewWithHighlights(text, X_LIMIT)
                      )}
                    </div>

                    {/* Sim Twitter Buttons */}
                    <div className="flex items-center justify-between text-slate-500 pt-3 text-xs max-w-sm select-none">
                      <div className="flex items-center space-x-1.5 hover:text-sky-500 cursor-pointer">
                        <span className="p-1 rounded-full hover:bg-sky-50">💬</span>
                        <span>0</span>
                      </div>
                      <div className="flex items-center space-x-1.5 hover:text-emerald-500 cursor-pointer">
                        <span className="p-1 rounded-full hover:bg-emerald-50">🔁</span>
                        <span>0</span>
                      </div>
                      <div className="flex items-center space-x-1.5 hover:text-rose-500 cursor-pointer">
                        <span className="p-1 rounded-full hover:bg-rose-50">♥</span>
                        <span>0</span>
                      </div>
                      <div className="flex items-center space-x-1.5 hover:text-sky-500 cursor-pointer">
                        <span className="p-1 rounded-full hover:bg-sky-50">📊</span>
                        <span>42</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* MOCK: Bluesky Social Card */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="bg-sky-50/50 border-b border-sky-100/50 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-bold text-sky-800 flex items-center space-x-1">
                  <Cloud className="h-3.5 w-3.5 text-sky-500 fill-sky-100" />
                  <span>Bluesky Skeet Preview</span>
                </span>
                <span className="text-[10px] font-mono text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                  Max 300
                </span>
              </div>

              {/* Bluesky Post Detail Card Body */}
              <div className="p-4 font-sans">
                <div className="flex items-start space-x-3">
                  <div className="h-10 w-10 rounded-sm shrink-0 overflow-hidden select-none flex items-center justify-center font-bold text-slate-600 bg-gradient-to-tr from-cyan-400 to-sky-400 text-white">
                    JD
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-1 text-sm">
                      <span className="font-extrabold text-slate-900">John Doe</span>
                      <span className="text-slate-500 font-normal">
                        {bskyCreds.handle ? `@${bskyCreds.handle}` : "@johndoe.bsky.social"}
                      </span>
                      <span className="text-slate-400 select-none">·</span>
                      <span className="text-slate-400">1m</span>
                    </div>

                    <div className="text-sm text-slate-900 leading-normal break-words whitespace-pre-wrap">
                      {text.length === 0 ? (
                        <span className="text-slate-400 italic">No content composed. Begin typing in the editor on the left to preview...</span>
                      ) : (
                        renderPreviewWithHighlights(text, BSKY_LIMIT)
                      )}
                    </div>

                    {/* Sim Bluesky Buttons */}
                    <div className="flex items-center justify-between text-slate-500 pt-3 text-xs max-w-sm select-none">
                      <div className="flex items-center space-x-1.5 hover:text-sky-500 cursor-pointer">
                        <span className="p-1 rounded-full hover:bg-sky-50">🗣</span>
                        <span>0</span>
                      </div>
                      <div className="flex items-center space-x-1.5 hover:text-sky-500 cursor-pointer">
                        <span className="p-1 rounded-full hover:bg-sky-50">♻</span>
                        <span>0</span>
                      </div>
                      <div className="flex items-center space-x-1.5 hover:text-pink-500 cursor-pointer">
                        <span className="p-1 rounded-full hover:bg-pink-50">🤍</span>
                        <span>0</span>
                      </div>
                      <div className="flex items-center space-x-1.5 hover:text-sky-500 cursor-pointer">
                        <span className="p-1 rounded-full hover:bg-sky-50">⋯</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Developer Mode Chrome Core Extension Blueprint Inspector */}
            <div className="p-5 border border-slate-200 bg-white rounded-xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-1.5">
                  <Code className="h-5 w-5 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">Extension Source Code Preview</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                  MANIFEST V3
                </span>
              </div>

              {/* Navigation File List */}
              <div className="flex space-x-1 border-b border-slate-100 pb-1.5 overflow-x-auto">
                {(["manifest.json", "popup.html", "popup.js", "README.md"] as ExtensionFile[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setActiveFile(f);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                      activeFile === f 
                        ? "bg-slate-100 text-slate-900 font-bold" 
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Extension Code Display Pane */}
              <div className="p-3 bg-slate-950 rounded-lg text-xs leading-relaxed font-mono text-slate-300 relative overflow-hidden select-all max-h-[160px] overflow-y-auto">
                <button
                  type="button"
                  onClick={copyTemplate}
                  className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded transition-colors cursor-pointer"
                  title="Copy Code"
                >
                  {copiedFile ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre className="whitespace-pre overflow-x-auto" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  {activeFile === "manifest.json" && fullExtensionTemplates.manifest}
                  {activeFile === "popup.html" && fullExtensionTemplates.html}
                  {activeFile === "popup.js" && fullExtensionTemplates.js}
                  {activeFile === "README.md" && fullExtensionTemplates.readme}
                </pre>
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                <strong>💡 Tip:</strong> You don't have to copy these manually. Click the <strong>Download Chrome Extension</strong> button in the header or below to fetch a fully assembled <code>.zip</code> file with standard layouts.
              </div>

              <button
                onClick={handleDownloadZip}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                id="btn-download-blueprint"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Compiled Extension Folder (.zip)</span>
              </button>
            </div>

          </div>

        </div>
      </main>

      {/* Modern Footer with Instructions */}
      <footer className="mt-16 bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <p className="text-sm font-semibold text-slate-400">SYNCPOST BRIDGE · DESIGNED TO STREAMLINE</p>
          <div className="flex flex-col md:flex-row items-center justify-center md:space-x-8 space-y-2 md:space-y-0 text-slate-500 text-xs">
            <span className="flex items-center space-x-1.5">
              <span>✔ Direct ATP Bluesky Posting</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span>✔ Local Credentials Safety</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span>✔ Custom Gemini Copywriting optimizer</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span>✔ Downloadable Developer Zip package</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            This dashboard was crafted as a companion application allowing content managers to simulate, preview, optimize and fully deploy custom developer browser extensions.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Helper to highlight characters that exceed the length limit elegantly in red
function renderPreviewWithHighlights(text: string, limit: number) {
  if (text.length <= limit) {
    return <span>{text}</span>;
  }

  const normalPart = text.substring(0, limit);
  const exceededPart = text.substring(limit);

  return (
    <span>
      {normalPart}
      <span className="bg-rose-100 text-rose-800 border-b border-rose-400 font-medium px-0.5 rounded cursor-help" title="Exceeds the platform post limit!">
        {exceededPart}
      </span>
    </span>
  );
}
