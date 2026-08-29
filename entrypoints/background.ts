import { createTranscriptFilename, formatTranscript } from "../src/domain/transcript";
import {
  DRIVE_SYNC_MESSAGE,
  type DriveSyncMessage,
  type DriveSyncResponse,
} from "../src/drive/messages";
import { DriveHttpError, GoogleDriveClient } from "../src/drive/google-drive";

export default defineBackground(() => {
  const identity = {
    getAuthToken: (details?: { interactive?: boolean }) => browser.identity.getAuthToken(details),
    removeCachedAuthToken: (details: { token: string }) =>
      browser.identity.removeCachedAuthToken(details),
  };
  const drive = new GoogleDriveClient(fetch, identity);

  browser.runtime.onMessage.addListener(
    (message: DriveSyncMessage): Promise<DriveSyncResponse> | undefined => {
      if (message?.type !== DRIVE_SYNC_MESSAGE) return undefined;
      return syncToDrive(message);
    },
  );

  async function syncToDrive(message: DriveSyncMessage): Promise<DriveSyncResponse> {
    try {
      const token = await drive.getAccessToken(message.interactive);
      return await syncWithToken(message, token);
    } catch (error) {
      if (!(error instanceof DriveHttpError) || error.status !== 401) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Google Drive保存に失敗しました",
        };
      }
      return retryAfterClearingToken(message, error);
    }
  }

  async function retryAfterClearingToken(
    message: DriveSyncMessage,
    error: DriveHttpError,
  ): Promise<DriveSyncResponse> {
    try {
      const token = await drive.getAccessToken(message.interactive);
      await identity.removeCachedAuthToken({ token });
      const refreshedToken = await drive.getAccessToken(message.interactive);
      return await syncWithToken(message, refreshedToken);
    } catch {
      return { ok: false, message: error.message || "Google Driveの認証が切れています" };
    }
  }

  async function syncWithToken(
    message: DriveSyncMessage,
    token: string,
  ): Promise<DriveSyncResponse> {
    const folderId = message.payload.session.driveFolderId ?? (await drive.ensureFolder(token));
    const fileId = message.payload.session.driveFileId
      ? await updateExisting(token, message.payload.session.driveFileId, message)
      : await drive.createTranscript(
          token,
          folderId,
          message.payload.filename || createTranscriptFilename(),
          formatTranscript(message.payload.session, message.payload.entries),
        );
    return { ok: true, fileId, folderId };
  }

  async function updateExisting(
    token: string,
    fileId: string,
    message: DriveSyncMessage,
  ): Promise<string> {
    await drive.updateTranscript(
      token,
      fileId,
      formatTranscript(message.payload.session, message.payload.entries),
    );
    return fileId;
  }
});
