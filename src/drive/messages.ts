import type { SubtitleEntry, MeetingSession } from "../domain/types";

export const DRIVE_SYNC_MESSAGE = "drive-sync";
export const DRIVE_AUTH_MESSAGE = "drive-auth";

export type DriveAuthMessage = {
  type: typeof DRIVE_AUTH_MESSAGE;
  interactive: true;
};

export type DriveAuthResponse = { ok: true } | { ok: false; message: string };

export type DriveSyncPayload = {
  session: MeetingSession;
  entries: SubtitleEntry[];
  filename: string;
};

export type DriveSyncMessage = {
  type: typeof DRIVE_SYNC_MESSAGE;
  interactive: boolean;
  payload: DriveSyncPayload;
};

export type DriveSyncResponse =
  | { ok: true; fileId: string; folderId: string }
  | { ok: false; message: string };

export type DriveMessage = DriveAuthMessage | DriveSyncMessage;
export type DriveResponse = DriveAuthResponse | DriveSyncResponse;
