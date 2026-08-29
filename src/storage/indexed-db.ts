import type { MeetingSession, SubtitleEntry, SyncQueueItem } from "../domain/types";

export const DATABASE_NAME = "meet-subtitles";
export const DATABASE_VERSION = 1;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openSubtitleDatabase(
  indexedDBFactory: IDBFactory = globalThis.indexedDB,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const sessions = database.objectStoreNames.contains("sessions")
        ? request.transaction!.objectStore("sessions")
        : database.createObjectStore("sessions", { keyPath: "id" });
      sessions.createIndex("byMeetingKey", "meetingKey", { unique: false });
      sessions.createIndex("byStatus", "status", { unique: false });

      const entries = database.objectStoreNames.contains("entries")
        ? request.transaction!.objectStore("entries")
        : database.createObjectStore("entries", { keyPath: "id" });
      entries.createIndex("bySessionSequence", ["sessionId", "sequence"], { unique: true });
      entries.createIndex("bySessionSourceKey", ["sessionId", "sourceKey"], { unique: true });

      if (!database.objectStoreNames.contains("syncQueue")) {
        const syncQueue = database.createObjectStore("syncQueue", { keyPath: "sessionId" });
        syncQueue.createIndex("byState", "state", { unique: false });
        syncQueue.createIndex("byUpdatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
  });
}

export class SubtitleRepository {
  private databasePromise: Promise<IDBDatabase> | undefined;

  constructor(private readonly indexedDBFactory: IDBFactory = globalThis.indexedDB) {}

  private open(): Promise<IDBDatabase> {
    this.databasePromise ??= openSubtitleDatabase(this.indexedDBFactory);
    return this.databasePromise;
  }

  async saveSession(session: MeetingSession): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction("sessions", "readwrite");
    transaction.objectStore("sessions").put(session);
    await transactionToPromise(transaction);
  }

  async getSession(sessionId: string): Promise<MeetingSession | undefined> {
    const database = await this.open();
    const transaction = database.transaction("sessions", "readonly");
    return requestToPromise(transaction.objectStore("sessions").get(sessionId));
  }

  async saveEntry(entry: SubtitleEntry): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(["sessions", "entries"], "readwrite");
    transaction.objectStore("entries").put(entry);
    const session = await requestToPromise<MeetingSession | undefined>(
      transaction.objectStore("sessions").get(entry.sessionId),
    );
    if (session) {
      transaction.objectStore("sessions").put({ ...session, lastCapturedAt: entry.occurredAt });
    }
    await transactionToPromise(transaction);
  }

  async listEntries(sessionId: string): Promise<SubtitleEntry[]> {
    const database = await this.open();
    const transaction = database.transaction("entries", "readonly");
    const entries = await requestToPromise<SubtitleEntry[]>(
      transaction
        .objectStore("entries")
        .index("bySessionSequence")
        .getAll(IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])),
    );
    return entries.sort((left, right) => left.sequence - right.sequence);
  }

  async saveSyncQueue(item: SyncQueueItem): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction("syncQueue", "readwrite");
    transaction.objectStore("syncQueue").put(item);
    await transactionToPromise(transaction);
  }

  async getSyncQueue(sessionId: string): Promise<SyncQueueItem | undefined> {
    const database = await this.open();
    const transaction = database.transaction("syncQueue", "readonly");
    return requestToPromise(transaction.objectStore("syncQueue").get(sessionId));
  }

  close(): void {
    this.databasePromise?.then((database) => database.close());
    this.databasePromise = undefined;
  }
}
