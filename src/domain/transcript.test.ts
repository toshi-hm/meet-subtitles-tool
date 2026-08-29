import { describe, expect, it } from "vitest";
import { CaptionAccumulator } from "./caption-accumulator";
import { createTranscriptFilename, formatElapsedTime, formatTranscript } from "./transcript";
import type { MeetingSession } from "./types";

const session: MeetingSession = {
  id: "session-1",
  meetingKey: "abc-defg-hij",
  startedAt: Date.parse("2026-08-29T00:00:00.000Z"),
  lastCapturedAt: Date.parse("2026-08-29T00:01:31.000Z"),
  status: "active",
};

describe("transcript formatting", () => {
  it("formats elapsed time as hh:mm:ss", () => {
    expect(formatElapsedTime(session.lastCapturedAt, session.startedAt)).toBe("00:01:31");
  });

  it("formats each entry using two lines and a blank separator", () => {
    const accumulator = new CaptionAccumulator(session.id);
    const first = accumulator.upsert({
      speaker: "  Alice  ",
      text: " hello   world ",
      occurredAt: session.startedAt + 1000,
      sourceKey: "caption-1",
    });
    const second = accumulator.upsert({
      speaker: "",
      text: "next line",
      occurredAt: session.startedAt + 2000,
      sourceKey: "caption-2",
    });

    expect(formatTranscript(session, [first, second])).toBe(
      "[00:00:01] Alice\nhello world\n\n[00:00:02] 不明な話者\nnext line",
    );
  });

  it("updates an in-progress caption instead of duplicating it", () => {
    const accumulator = new CaptionAccumulator(session.id);
    accumulator.upsert({
      speaker: "Alice",
      text: "hello",
      occurredAt: session.startedAt,
      sourceKey: "caption-1",
    });
    accumulator.upsert({
      speaker: "Alice",
      text: "hello there",
      occurredAt: session.startedAt + 500,
      sourceKey: "caption-1",
    });

    expect(accumulator.getEntries()).toHaveLength(1);
    expect(accumulator.getEntries()[0]?.text).toBe("hello there");
  });

  it("creates a deterministic local filename", () => {
    expect(createTranscriptFilename(new Date("2026-08-29T12:34:56"))).toBe(
      "meet-subtitles-2026-08-29-123456.txt",
    );
  });
});
