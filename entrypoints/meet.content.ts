import { CaptionAccumulator } from "../src/domain/caption-accumulator";
import { createTranscriptFilename, formatTranscript } from "../src/domain/transcript";
import type { MeetingSession } from "../src/domain/types";
import {
  DRIVE_AUTH_MESSAGE,
  DRIVE_SYNC_MESSAGE,
  type DriveAuthResponse,
  type DriveSyncResponse,
} from "../src/drive/messages";
import { enableCaptions, getMeetingKey } from "../src/meet/caption-dom";
import { MeetCaptionObserver } from "../src/meet/caption-observer";
import { MeetingLifecycleObserver } from "../src/meet/meeting-lifecycle";
import { SubtitleRepository } from "../src/storage/indexed-db";
import { FloatingPanel } from "../src/ui/floating-panel";

function createSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}`;
}

function downloadText(document: Document, text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default defineContentScript({
  matches: ["https://meet.google.com/*"],
  runAt: "document_start",
  async main(ctx) {
    const repository = new SubtitleRepository();
    const meetingKey = getMeetingKey(window.location);
    const existingSession = await repository.findActiveSession(meetingKey);
    const existingEntries = existingSession ? await repository.listEntries(existingSession.id) : [];
    const session: MeetingSession = existingSession ?? {
      id: createSessionId(),
      meetingKey,
      startedAt: Date.now(),
      lastCapturedAt: Date.now(),
      status: "active",
    };
    await repository.saveSession(session);
    const accumulator = new CaptionAccumulator(session.id, existingEntries.length, existingEntries);

    const connectDrive = async (): Promise<void> => {
      panel.update("authenticating", (await repository.listEntries(session.id)).length);
      try {
        const response = (await browser.runtime.sendMessage({
          type: DRIVE_AUTH_MESSAGE,
          interactive: true,
        })) as DriveAuthResponse;
        if (!response?.ok)
          throw new Error(response?.message ?? "Google Driveに接続できませんでした");
        panel.setDriveActionLabel("Drive保存");
        panel.update("saved", (await repository.listEntries(session.id)).length);
        panel.notify("Google Driveに接続しました。会議終了時に自動保存します");
      } catch (error) {
        panel.update("error", (await repository.listEntries(session.id)).length);
        throw error;
      }
    };

    const requestDriveSync = async (interactive: boolean): Promise<void> => {
      const entries = await repository.listEntries(session.id);
      if (entries.length === 0) throw new Error("保存する字幕がまだありません");
      const response = (await browser.runtime.sendMessage({
        type: DRIVE_SYNC_MESSAGE,
        interactive,
        payload: {
          session,
          entries,
          filename: createTranscriptFilename(new Date(session.startedAt)),
        },
      })) as DriveSyncResponse;
      if (!response?.ok) throw new Error(response?.message ?? "Google Drive保存に失敗しました");
      session.driveFileId = response.fileId;
      session.driveFolderId = response.folderId;
      if (session.status === "ending") session.status = "completed";
      await repository.saveSession(session);
      await repository.saveSyncQueue({
        sessionId: session.id,
        state: "completed",
        updatedAt: Date.now(),
      });
    };

    const panel = new FloatingPanel(document, {
      onCopy: async () => {
        const entries = await repository.listEntries(session.id);
        if (entries.length === 0) throw new Error("コピーする字幕がまだありません");
        if (!navigator.clipboard)
          throw new Error("クリップボードを利用できません。TXT保存をお試しください");
        await navigator.clipboard.writeText(formatTranscript(session, entries));
        panel.notify("字幕をクリップボードにコピーしました");
      },
      onDownload: async () => {
        const entries = await repository.listEntries(session.id);
        if (entries.length === 0) throw new Error("保存する字幕がまだありません");
        downloadText(document, formatTranscript(session, entries), createTranscriptFilename());
        panel.notify("TXTファイルを保存しました");
      },
      onDrive: async () => {
        if ((await repository.listEntries(session.id)).length === 0) {
          await connectDrive();
          return;
        }
        await requestDriveSync(true);
        panel.notify("Google Driveに保存しました");
      },
    });
    panel.update("initialising", existingEntries.length);
    panel.setDriveActionLabel(existingEntries.length > 0 ? "Drive保存" : "Drive接続");

    const start = (): void => {
      let observerStarted = false;
      const tryEnableCaptions = (): void => {
        const state = enableCaptions(document);
        if (state === "off" || state === "unknown") {
          panel.update("waiting", accumulator.getEntries().length);
          return;
        }
        if (observerStarted) return;
        observerStarted = true;
        panel.update("capturing", accumulator.getEntries().length);
        const observer = new MeetCaptionObserver({
          document,
          onCaption: (candidate) => {
            const entry = accumulator.upsert(candidate);
            void repository.saveEntry(entry).then(async () => {
              panel.setDriveActionLabel("Drive保存");
              panel.update("capturing", accumulator.getEntries().length);
              await repository.saveSyncQueue({
                sessionId: session.id,
                state: "pending",
                updatedAt: Date.now(),
              });
            });
          },
        });
        observer.start();
        const finishSession = (): void => {
          if (session.status === "completed") return;
          session.status = "ending";
          void repository.saveSession(session);
          panel.update("saving", accumulator.getEntries().length);
          void requestDriveSync(false).catch(() => undefined);
        };
        const lifecycle = new MeetingLifecycleObserver({
          document,
          onEnd: finishSession,
        });
        lifecycle.start();
        ctx.addEventListener(window, "pagehide", () => {
          finishSession();
        });
        ctx.addEventListener(window, "beforeunload", () => {
          finishSession();
        });
      };

      tryEnableCaptions();
      ctx.setInterval(tryEnableCaptions, 1000);
      ctx.setInterval(() => {
        void requestDriveSync(false).catch(() => undefined);
      }, 30_000);
    };

    if (document.body) start();
    else ctx.addEventListener(document, "DOMContentLoaded", start, { once: true });
  },
});
