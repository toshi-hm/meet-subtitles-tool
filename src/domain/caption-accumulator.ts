import { normaliseCaptionText, normaliseSpeaker } from "./transcript";
import type { CaptionCandidate, SubtitleEntry } from "./types";

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `subtitle-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export class CaptionAccumulator {
  private readonly entries = new Map<string, SubtitleEntry>();

  constructor(
    private readonly sessionId: string,
    private nextSequence = 0,
  ) {}

  upsert(candidate: CaptionCandidate): SubtitleEntry {
    const text = normaliseCaptionText(candidate.text);
    const speaker = normaliseSpeaker(candidate.speaker);
    const previous = this.entries.get(candidate.sourceKey);

    if (previous) {
      const updated = {
        ...previous,
        occurredAt: candidate.occurredAt,
        speaker,
        text,
      };
      this.entries.set(candidate.sourceKey, updated);
      return updated;
    }

    const entry: SubtitleEntry = {
      id: createId(),
      sessionId: this.sessionId,
      sequence: this.nextSequence++,
      occurredAt: candidate.occurredAt,
      speaker,
      text,
      sourceKey: candidate.sourceKey,
      finalized: false,
    };
    this.entries.set(candidate.sourceKey, entry);
    return entry;
  }

  finalize(sourceKey: string): SubtitleEntry | undefined {
    const entry = this.entries.get(sourceKey);
    if (!entry) return undefined;

    const finalized = { ...entry, finalized: true };
    this.entries.set(sourceKey, finalized);
    return finalized;
  }

  getEntries(): SubtitleEntry[] {
    return [...this.entries.values()].sort((left, right) => left.sequence - right.sequence);
  }
}
