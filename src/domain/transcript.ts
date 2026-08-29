import type { MeetingSession, SubtitleEntry } from "./types";

export function normaliseCaptionText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function normaliseSpeaker(speaker: string): string {
  const value = speaker.replace(/[ \t]+/g, " ").trim();
  return value || "不明な話者";
}

export function formatElapsedTime(occurredAt: number, startedAt: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((occurredAt - startedAt) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function formatTranscript(session: MeetingSession, entries: SubtitleEntry[]): string {
  return [...entries]
    .sort((left, right) => left.sequence - right.sequence)
    .map(
      (entry) =>
        `[${formatElapsedTime(entry.occurredAt, session.startedAt)}] ${normaliseSpeaker(entry.speaker)}\n${normaliseCaptionText(entry.text)}`,
    )
    .filter((entry) => !entry.endsWith("\n"))
    .join("\n\n");
}

export function createTranscriptFilename(date = new Date()): string {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join("");

  return `meet-subtitles-${parts.join("-")}-${time}.txt`;
}
