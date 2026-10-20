export interface BlueskyCredentials {
  handle: string;
  appPassword: string;
}

export interface ThreadsCredentials {
  accessToken: string;
  tokenRefreshedAt: number;
}

export interface PostDraft {
  text: string;
  publishToX: boolean;
  publishToBsky: boolean;
  publishToThreads: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "success" | "error" | "info";
  network: "X" | "Bluesky" | "Threads" | "AI" | "System";
  message: string;
  link?: string;
}

export type ExtensionFile = "manifest.json" | "popup.html" | "popup.js" | "background.js" | "README.md";

export interface ExtensionCodeTemplates {
  manifest: string;
  html: string;
  js: string;
  background: string;
  readme: string;
}
