export interface BlueskyCredentials {
  handle: string;
  appPassword: string;
}

export interface PostDraft {
  text: string;
  publishToX: boolean;
  publishToBsky: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "success" | "error" | "info";
  network: "X" | "Bluesky" | "AI" | "System";
  message: string;
  link?: string;
}

export type ExtensionFile = "manifest.json" | "popup.html" | "popup.js" | "README.md";

export interface ExtensionCodeTemplates {
  manifest: string;
  html: string;
  js: string;
  readme: string;
}
