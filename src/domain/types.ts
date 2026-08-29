export type SessionStatus = "active" | "ending" | "completed" | "sync-failed";

export const SESSION_RETENTION_MS = 24 * 60 * 60 * 1000;

export type MeetingSession = {
  id: string;
  meetingKey: string;
  startedAt: number;
  retentionExpiresAt: number;
  lastCapturedAt: number;
  status: SessionStatus;
  driveFileId?: string;
  driveFolderId?: string;
};

export type SubtitleEntry = {
  id: string;
  sessionId: string;
  sequence: number;
  occurredAt: number;
  speaker: string;
  text: string;
  sourceKey: string;
  finalized: boolean;
};

export type CaptionCandidate = {
  speaker: string;
  text: string;
  occurredAt: number;
  sourceKey: string;
};

export type SyncQueueItem = {
  sessionId: string;
  state: "pending" | "syncing" | "completed" | "failed";
  updatedAt: number;
  lastError?: string;
};
