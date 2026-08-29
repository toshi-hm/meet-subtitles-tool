import type { SubtitleEntry, MeetingSession } from "../domain/types";

export const DRIVE_SYNC_MESSAGE = "drive-sync";

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
