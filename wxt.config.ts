import { defineConfig } from "wxt";

const nodeGlobal = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};
const oauthClientId =
  nodeGlobal.process?.env?.WXT_GOOGLE_OAUTH_CLIENT_ID ??
  "YOUR_EXTENSION_OAUTH_CLIENT_ID.apps.googleusercontent.com";

export default defineConfig({
  manifest: {
    name: "Meet Subtitles",
    description: "Google Meetの字幕を保存しやすくする拡張機能",
    permissions: ["identity", "storage"],
    host_permissions: ["https://meet.google.com/*"],
    oauth2: {
      client_id: oauthClientId,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    },
    action: {
      default_title: "Meet Subtitles",
    },
    icons: {
      16: "/icon-16.png",
      32: "/icon-32.png",
      48: "/icon-48.png",
      128: "/icon-128.png",
    },
  },
});
