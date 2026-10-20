import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import JSZip from "jszip";
import { buildExtensionFiles } from "./extension";

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

// Threads Graph API (官方文件: https://developers.facebook.com/documentation/threads/posts)
const THREADS_API = "https://graph.threads.com";
const THREADS_LIMIT = 500;

// Threads counts emoji by their UTF-8 byte length; everything else counts as one character.
const encoder = new TextEncoder();
const calculateThreadsLength = (str: string): number =>
  [...str].reduce((sum, ch) => sum + (/\p{Extended_Pictographic}/u.test(ch) ? encoder.encode(ch).length : 1), 0);

const threadsRequest = async (method: "GET" | "POST", endpoint: string, params: Record<string, string>) => {
  const query = new URLSearchParams(params);
  const response = method === "GET"
    ? await fetch(`${THREADS_API}${endpoint}?${query}`)
    : await fetch(`${THREADS_API}${endpoint}`, { method, body: query });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Threads API request failed (${response.status}).`);
  }
  return data;
};

// 2b. Threads Graph API posting proxy route
app.post("/api/publish/threads", async (req, res) => {
  try {
    const { accessToken, content, renewToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: "Threads access token is required." });
    }
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Post content is empty." });
    }
    if (calculateThreadsLength(content) > THREADS_LIMIT) {
      return res.status(400).json({ error: `Content exceeds Threads' ${THREADS_LIMIT} character limit.` });
    }

    // A. Resolve the Threads user ID behind the token, then create a text media container
    const { id: userId } = await threadsRequest("GET", "/v1.0/me", { fields: "id", access_token: accessToken });
    const container = await threadsRequest("POST", `/v1.0/${userId}/threads`, {
      media_type: "TEXT",
      text: content,
      access_token: accessToken,
    });

    // B. Wait until the container is ready (text posts are usually ready immediately)
    for (let attempt = 0; attempt < 5; attempt++) {
      const { status, error_message } = await threadsRequest("GET", `/v1.0/${container.id}`, {
        fields: "status,error_message",
        access_token: accessToken,
      });
      if (status === "FINISHED") break;
      if (status === "ERROR" || status === "EXPIRED") {
        throw new Error(error_message || `Threads media container ${status.toLowerCase()}.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // C. Publish the container
    const published = await threadsRequest("POST", `/v1.0/${userId}/threads_publish`, {
      creation_id: container.id,
      access_token: accessToken,
    });

    const { permalink } = await threadsRequest("GET", `/v1.0/${published.id}`, {
      fields: "permalink",
      access_token: accessToken,
    }).catch(() => ({ permalink: undefined }));

    // D. Long-lived tokens expire after 60 days unless refreshed, so renew when the client asks
    let newAccessToken: string | undefined;
    if (renewToken) {
      const refreshed = await threadsRequest("GET", "/refresh_access_token", {
        grant_type: "th_refresh_token",
        access_token: accessToken,
      }).catch((err) => {
        console.error("Threads token refresh failed:", err);
        return null;
      });
      newAccessToken = refreshed?.access_token;
    }

    res.json({ success: true, id: published.id, url: permalink, newAccessToken });
  } catch (error: any) {
    console.error("Threads posting failed:", error);
    res.status(500).json({ error: error.message || "Failed to publish to Threads." });
  }
});

// 3. Dynamic Chrome Extension ZIP Generator
app.get("/api/download-extension", async (req, res) => {
  try {
    const zip = new JSZip();

    for (const [name, content] of Object.entries(buildExtensionFiles())) {
      zip.file(name, content);
    }

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
