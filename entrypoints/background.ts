import { createTranscriptFilename, formatTranscript } from "../src/domain/transcript";
import {
  DRIVE_AUTH_MESSAGE,
  DRIVE_SYNC_MESSAGE,
  type DriveAuthMessage,
  type DriveAuthResponse,
  type DriveMessage,
  type DriveResponse,
  type DriveSyncMessage,
  type DriveSyncResponse,
} from "../src/drive/messages";
import { GoogleDriveOAuth } from "../src/drive/google-oauth";
import { DriveHttpError, GoogleDriveClient } from "../src/drive/google-drive";
import { toDriveErrorMessage } from "../src/drive/errors";

export default defineBackground(() => {
  const oauth = new GoogleDriveOAuth(
    {
      getRedirectURL: () => browser.identity.getRedirectURL(),
      launchWebAuthFlow: (details) => browser.identity.launchWebAuthFlow(details),
    },
    browser.storage.local,
    fetch,
  );
  const drive = new GoogleDriveClient(fetch);

  browser.runtime.onMessage.addListener(
    (message: DriveMessage): Promise<DriveResponse> | undefined => {
      if (message?.type === DRIVE_AUTH_MESSAGE) return authenticateDrive(message);
      if (message?.type !== DRIVE_SYNC_MESSAGE) return undefined;
      return syncToDrive(message);
    },
  );

  async function authenticateDrive(message: DriveAuthMessage): Promise<DriveAuthResponse> {
    try {
      await oauth.getAccessToken(message.interactive);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: toDriveErrorMessage(error, "エラー: Google Driveへの接続に失敗しました。"),
      };
    }
  }

  async function syncToDrive(message: DriveSyncMessage): Promise<DriveSyncResponse> {
    try {
      const token = await oauth.getAccessToken(message.interactive);
      return await syncWithToken(message, token);
    } catch (error) {
      if (!(error instanceof DriveHttpError) || error.status !== 401) {
        return {
          ok: false,
          message: toDriveErrorMessage(error, "エラー: Google Drive保存に失敗しました。"),
        };
      }
      return retryAfterClearingToken(message);
    }
  }

  async function retryAfterClearingToken(message: DriveSyncMessage): Promise<DriveSyncResponse> {
    try {
      await oauth.clearCachedAuth();
      const refreshedToken = await oauth.getAccessToken(message.interactive);
      return await syncWithToken(message, refreshedToken);
    } catch (retryError) {
      return {
        ok: false,
        message: toDriveErrorMessage(retryError, "エラー: Google Driveの認証が切れています。"),
      };
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
