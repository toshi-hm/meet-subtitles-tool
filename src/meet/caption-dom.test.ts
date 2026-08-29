import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { enableCaptions, extractCaptionCandidates, getCaptionToggleState } from "./caption-dom";

describe("caption DOM adapter", () => {
  it("recognises an off captions button and enables it", () => {
    const window = new Window();
    const button = window.document.createElement("button");
    button.setAttribute("aria-label", "Turn on captions");
    button.setAttribute("aria-pressed", "false");
    window.document.body.append(button);

    expect(getCaptionToggleState(window.document)).toBe("off");
    expect(enableCaptions(window.document)).toBe("on");
    expect(button.onclick).toBeNull();
  });

  it("extracts speaker, source key, and text from a caption entry", () => {
    const window = new Window();
    const root = window.document.createElement("div");
    root.innerHTML =
      '<div data-caption-entry data-source-key="one" data-speaker="Alice"><span data-caption-text="">Hello world</span></div>';

    expect(extractCaptionCandidates(root, 1_000)).toEqual([
      { sourceKey: "one", speaker: "Alice", text: "Hello world", occurredAt: 1_000 },
    ]);
  });
});
