import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { DATABASE_NAME, SubtitleRepository } from "./indexed-db";
import type { MeetingSession, SubtitleEntry } from "../domain/types";

const session: MeetingSession = {
  id: "session-db-1",
  meetingKey: "abc-defg-hij",
  startedAt: 1_000,
  lastCapturedAt: 1_000,
  status: "active",
};

const entry: SubtitleEntry = {
  id: "entry-1",
  sessionId: session.id,
  sequence: 0,
  occurredAt: 2_000,
  speaker: "Alice",
  text: "Hello",
  sourceKey: "caption-1",
  finalized: true,
};

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
});

describe("SubtitleRepository", () => {
  it("persists a session, entry, and sync state", async () => {
    const repository = new SubtitleRepository();
    await repository.saveSession(session);
    await repository.saveEntry(entry);
    await repository.saveSyncQueue({
      sessionId: session.id,
      state: "pending",
      updatedAt: 2_000,
    });

    expect(await repository.getSession(session.id)).toMatchObject({
      ...session,
      lastCapturedAt: entry.occurredAt,
    });
    expect(await repository.listEntries(session.id)).toEqual([entry]);
    expect(await repository.getSyncQueue(session.id)).toMatchObject({ state: "pending" });
    repository.close();
  });
});
