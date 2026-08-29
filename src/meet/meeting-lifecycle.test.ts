import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { isMeetingJoined, MeetingLifecycleObserver } from "./meeting-lifecycle";

describe("meeting lifecycle", () => {
  it("recognises an entered meeting from the leave control", () => {
    const window = new Window();
    expect(isMeetingJoined(window.document as unknown as Document)).toBe(false);
    const button = window.document.createElement("button");
    button.setAttribute("aria-label", "Leave call");
    window.document.body.append(button);

    expect(isMeetingJoined(window.document as unknown as Document)).toBe(true);
  });

  it("detects a leave button click once", () => {
    const window = new Window();
    const button = window.document.createElement("button");
    button.setAttribute("aria-label", "Leave call");
    window.document.body.append(button);
    const reasons: string[] = [];
    const observer = new MeetingLifecycleObserver({
      document: window.document as unknown as Document,
      onEnd: (reason) => reasons.push(reason),
    });
    observer.start();
    button.click();
    button.click();

    expect(reasons).toEqual(["leave-button"]);
    observer.stop();
  });

  it("detects a meeting ended message", async () => {
    const window = new Window();
    const reasons: string[] = [];
    const observer = new MeetingLifecycleObserver({
      document: window.document as unknown as Document,
      onEnd: (reason) => reasons.push(reason),
    });
    observer.start();
    window.document.body.innerHTML = "会議が終了しました";
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(reasons).toEqual(["meeting-ended"]);
    observer.stop();
  });
});
