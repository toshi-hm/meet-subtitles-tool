// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingPanel } from "./floating-panel";
import type { MeetingSession, SubtitleEntry } from "../domain/types";

const session: MeetingSession = {
  id: "session-ui-1",
  meetingKey: "abc-defg-hij",
  startedAt: Date.parse("2026-08-29T00:00:00.000Z"),
  retentionExpiresAt: Date.parse("2026-08-30T00:00:00.000Z"),
  lastCapturedAt: Date.parse("2026-08-29T00:01:31.000Z"),
  status: "active",
};

function createEntry(overrides: Partial<SubtitleEntry> = {}): SubtitleEntry {
  return {
    id: "entry-1",
    sessionId: session.id,
    sequence: 0,
    occurredAt: session.startedAt + 12_000,
    speaker: "Alice",
    text: "最初の発話",
    sourceKey: "caption-1",
    finalized: true,
    ...overrides,
  };
}

function createPanel(): FloatingPanel {
  return new FloatingPanel(document, {
    onCopy: vi.fn(),
    onDownload: vi.fn(),
    onDrive: vi.fn(),
  });
}

afterEach(() => {
  document.getElementById("meet-subtitles-floating-panel")?.remove();
});

describe("FloatingPanel subtitle history", () => {
  it("renders restored entries with elapsed time, speaker, and text", () => {
    const panel = createPanel();
    panel.updateTranscript(session, [
      createEntry(),
      createEntry({
        id: "entry-2",
        sequence: 1,
        occurredAt: session.startedAt + 91_000,
        speaker: "Bob",
        text: "二つ目の発話",
      }),
    ]);

    const transcript = document
      .getElementById("meet-subtitles-floating-panel")
      ?.shadowRoot?.querySelector(".transcript");
    expect(transcript?.querySelectorAll(".entry")).toHaveLength(2);
    expect(transcript?.textContent).toContain("[00:00:12]Alice最初の発話");
    expect(transcript?.textContent).toContain("[00:01:31]Bob二つ目の発話");
    panel.destroy();
  });

  it("treats speaker and caption text as text, not markup", () => {
    const panel = createPanel();
    panel.updateTranscript(session, [
      createEntry({ speaker: "<img>speaker", text: "<strong>caption</strong>" }),
    ]);

    const transcript = document
      .getElementById("meet-subtitles-floating-panel")
      ?.shadowRoot?.querySelector(".transcript");
    expect(transcript?.querySelector("img, strong")).toBeNull();
    expect(transcript?.querySelector(".entry-speaker")?.textContent).toBe("<img>speaker");
    expect(transcript?.querySelector(".entry-text")?.textContent).toBe("<strong>caption</strong>");
    panel.destroy();
  });

  it("keeps the user's position when they have scrolled up", () => {
    const panel = createPanel();
    panel.updateTranscript(session, [createEntry()]);
    const transcript = document
      .getElementById("meet-subtitles-floating-panel")
      ?.shadowRoot?.querySelector(".transcript");
    if (!(transcript instanceof HTMLDivElement)) throw new Error("transcript element not found");

    Object.defineProperties(transcript, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 120, writable: true },
    });
    panel.updateTranscript(session, [
      createEntry(),
      createEntry({ id: "entry-2", sequence: 1, text: "新しい発話" }),
    ]);

    expect(transcript.scrollTop).toBe(120);
    panel.destroy();
  });
});
