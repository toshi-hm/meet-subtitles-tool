import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { DATABASE_NAME, SubtitleRepository } from "./indexed-db";
import type { MeetingSession, SubtitleEntry } from "../domain/types";

const session: MeetingSession = {
  id: "session-db-1",
  meetingKey: "abc-defg-hij",
  startedAt: 1_000,
  retentionExpiresAt: 86_401_000,
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

  it("deletes expired sessions and their related records", async () => {
    const repository = new SubtitleRepository();
    const expiredSession = { ...session, id: "expired", retentionExpiresAt: 2_000 };
    const retainedSession = { ...session, id: "retained", retentionExpiresAt: 4_000 };
    const expiredEntry = { ...entry, id: "expired-entry", sessionId: expiredSession.id };

    await repository.saveSession(expiredSession);
    await repository.saveSession(retainedSession);
    await repository.saveEntry(expiredEntry);
    await repository.saveSyncQueue({
      sessionId: expiredSession.id,
      state: "pending",
      updatedAt: 1_500,
    });

    await expect(repository.deleteExpiredSessions(2_000)).resolves.toBe(1);
    await expect(repository.getSession(expiredSession.id)).resolves.toBeUndefined();
    await expect(repository.listEntries(expiredSession.id)).resolves.toEqual([]);
    await expect(repository.getSyncQueue(expiredSession.id)).resolves.toBeUndefined();
    await expect(repository.getSession(retainedSession.id)).resolves.toEqual(retainedSession);
    repository.close();
  });

  it("can preserve the session currently being recorded", async () => {
    const repository = new SubtitleRepository();
    const currentSession = { ...session, id: "current", retentionExpiresAt: 2_000 };
    await repository.saveSession(currentSession);

    await expect(repository.deleteExpiredSessions(2_000, currentSession.id)).resolves.toBe(0);
    await expect(repository.getSession(currentSession.id)).resolves.toEqual(currentSession);
    repository.close();
  });
});
