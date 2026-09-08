import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Meet Subtitles",
    description: "Google Meetの字幕を保存しやすくする拡張機能",
    permissions: ["identity", "storage"],
    oauth2: {
      client_id: "969429256536-hv5itnr04orf32vi2flpukhembg27dh8.apps.googleusercontent.com",
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    },
    host_permissions: ["https://meet.google.com/*"],
    action: {
      default_title: "Meet Subtitles",
      default_popup: "popup.html",
    },
    icons: {
      16: "/icon-16.png",
      32: "/icon-32.png",
      48: "/icon-48.png",
      128: "/icon-128.png",
    },
  },
});
