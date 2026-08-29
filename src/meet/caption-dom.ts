import type { CaptionCandidate } from "../domain/types";

const CAPTION_ROOT_SELECTORS = [
  "[data-meet-captions]",
  ".a4cQT",
  '[jsname="tgaKEf"]',
  '[aria-live="polite"]',
  '[aria-live="assertive"]',
];

const CAPTION_ENTRY_SELECTORS = [
  "[data-caption-entry]",
  "[data-caption]",
  "[data-caption-text]",
  ".caption-entry",
  '[jsname="tgaKEf"] [role="text"]',
  '.a4cQT [role="text"]',
];

const CAPTION_TOGGLE_SELECTORS = ["button", '[role="button"]'];

export type CaptionToggleState = "on" | "off" | "unknown";

export function findCaptionRoots(document: Document): Element[] {
  const roots = CAPTION_ROOT_SELECTORS.flatMap((selector) => [
    ...document.querySelectorAll(selector),
  ]);
  const uniqueRoots = [...new Set(roots)];
  return uniqueRoots.filter((root) => {
    if (uniqueRoots.some((other) => other !== root && other.contains(root))) return false;
    const style = root instanceof HTMLElement ? document.defaultView?.getComputedStyle(root) : null;
    return style?.display !== "none" && style?.visibility !== "hidden";
  });
}

function findEntryElements(root: Element): Element[] {
  for (const selector of CAPTION_ENTRY_SELECTORS) {
    const elements = [...root.querySelectorAll(selector)];
    if (elements.length > 0) return elements;
  }
  return [...root.children].filter((element) => element.textContent?.trim());
}

function readAttribute(element: Element, names: string[]): string | undefined {
  for (const name of names) {
    const value = element.getAttribute(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function readText(element: Element): string {
  const textElement = element.matches("[data-caption-text]")
    ? element
    : element.querySelector('[data-caption-text], .caption-text, [role="text"]');
  return (textElement ?? element).textContent?.trim() ?? "";
}

export function extractCaptionCandidates(root: Element, occurredAt: number): CaptionCandidate[] {
  return findEntryElements(root)
    .map((element, index) => {
      const parent = element.closest("[data-caption-entry], [data-caption]") ?? element;
      const sourceKey =
        readAttribute(parent, ["data-source-key", "data-caption-id", "data-message-id", "id"]) ??
        `caption-${index}`;
      const speaker =
        readAttribute(parent, ["data-speaker", "data-caption-speaker"]) ??
        parent.querySelector("[data-caption-speaker], .caption-speaker")?.textContent?.trim() ??
        "不明な話者";

      return { sourceKey, speaker, text: readText(element), occurredAt };
    })
    .filter((candidate) => candidate.text.length > 0);
}

function getCaptionLabel(element: Element): string {
  return [
    element.getAttribute("aria-label"),
    element.getAttribute("data-tooltip"),
    element.getAttribute("title"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function getCaptionToggleState(document: Document): CaptionToggleState {
  for (const selector of CAPTION_TOGGLE_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      const label = getCaptionLabel(element);
      if (!label.includes("caption") && !label.includes("字幕")) continue;

      const pressed = element.getAttribute("aria-pressed");
      if (pressed === "true" || /turn off|disable|オフ|無効/.test(label)) return "on";
      if (pressed === "false" || /turn on|enable|オン|有効/.test(label)) return "off";
    }
  }
  return "unknown";
}

export function enableCaptions(document: Document): CaptionToggleState {
  const state = getCaptionToggleState(document);
  if (state !== "off") return state;

  for (const selector of CAPTION_TOGGLE_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      const label = getCaptionLabel(element);
      if (!label.includes("caption") && !label.includes("字幕")) continue;
      const pressed = element.getAttribute("aria-pressed");
      if (pressed === "false" || /turn on|enable|オン|有効/.test(label)) {
        (element as HTMLElement).click();
        return "on";
      }
    }
  }
  return "unknown";
}

export function getMeetingKey(location: Location): string {
  const key = location.pathname.split("/").filter(Boolean)[0];
  return key || location.host;
}
