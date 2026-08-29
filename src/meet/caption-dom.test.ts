import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import {
  enableCaptions,
  extractCaptionCandidates,
  findCaptionRoots,
  getCaptionToggleState,
} from "./caption-dom";

describe("caption DOM adapter", () => {
  it("recognises an off captions button and enables it", () => {
    const window = new Window();
    const button = window.document.createElement("button");
    button.setAttribute("aria-label", "Turn on captions");
    button.setAttribute("aria-pressed", "false");
    window.document.body.append(button);
    const document = window.document as unknown as Document;

    expect(getCaptionToggleState(document)).toBe("off");
    expect(enableCaptions(document)).toBe("on");
    expect(button.onclick).toBeNull();
  });

  it("extracts speaker, source key, and text from a caption entry", () => {
    const window = new Window();
    const root = window.document.createElement("div");
    root.innerHTML =
      '<div data-caption-entry data-source-key="one" data-speaker="Alice"><span data-caption-text="">Hello world</span></div>';

    expect(extractCaptionCandidates(root as unknown as Element, 1_000)).toEqual([
      { sourceKey: "one", speaker: "Alice", text: "Hello world", occurredAt: 1_000 },
    ]);
  });

  it("does not treat Meet accessibility announcements as caption roots", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div aria-live="polite">会議の準備が整いました</div>
      <div aria-live="assertive">
        <button>close閉じる</button>
        <button>言語を選択</button>
      </div>
    `;

    expect(findCaptionRoots(window.document as unknown as Document)).toEqual([]);
  });
});
