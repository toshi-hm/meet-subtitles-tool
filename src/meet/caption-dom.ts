import type { CaptionCandidate } from "../domain/types";

const CAPTION_ROOT_SELECTORS = [
  '[role="region"][aria-label="字幕"]',
  '[role="region"][aria-label="Captions"]',
  "[data-meet-captions]",
];

const CAPTION_ENTRY_SELECTORS = [
  ".nMcdL",
  "[data-caption-entry]",
  "[data-caption]",
  "[data-caption-text]",
  ".caption-entry",
  '[jsname="tgaKEf"] [role="text"]',
];

const CAPTION_TOGGLE_SELECTORS = ["button", '[role="button"]'];
const NON_CAPTION_ANCESTOR_SELECTORS = [
  '[role="dialog"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="combobox"]',
  '[aria-modal="true"]',
].join(",");

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
    const elements = [...root.querySelectorAll(selector)].filter(isCaptionEntryElement);
    if (elements.length > 0) return elements;
  }
  return [...root.children].filter(
    (element) => isCaptionEntryElement(element) && element.textContent?.trim(),
  );
}

function isCaptionEntryElement(element: Element): boolean {
  if (element.matches(NON_CAPTION_ANCESTOR_SELECTORS)) return false;
  if (element.closest(NON_CAPTION_ANCESTOR_SELECTORS)) return false;
  if (element.matches('button, a, input, select, textarea, [role="button"]')) return false;
  return true;
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
    : element.querySelector('[data-caption-text], .ygicle, .caption-text, [role="text"]');
  const source = textElement ?? element;
  const clone = source.cloneNode(true) as Element;
  clone
    .querySelectorAll('button, a, input, select, textarea, [role="button"]')
    .forEach((child) => child.remove());
  return clone.textContent?.trim() ?? "";
}

function getSelfSpeakerName(document: Document): string {
  const lines = (document.body?.innerText ?? document.body?.textContent ?? "").split(/\n+/);
  const ownAccountLine = lines.find((line) => /として参加中|joined as/i.test(line));
  const ownAccount = ownAccountLine?.replace(/\s*(?:として参加中|joined as).*$/i, "").trim();
  return ownAccount && ownAccount.length <= 100 ? ownAccount : "自分";
}

function resolveSpeakerName(parent: Element, speaker: string | undefined): string {
  const value = speaker?.trim() || "不明な話者";
  if (!/^(あなた|you)$/i.test(value)) return value;
  return getSelfSpeakerName(parent.ownerDocument);
}

export function extractCaptionCandidates(root: Element, occurredAt: number): CaptionCandidate[] {
  return findEntryElements(root)
    .map((element, index) => {
      const parent = element.closest("[data-caption-entry], [data-caption]") ?? element;
      const sourceKey =
        readAttribute(parent, ["data-source-key", "data-caption-id", "data-message-id", "id"]) ??
        `caption-${index}`;
      const rawSpeaker =
        readAttribute(parent, ["data-speaker", "data-caption-speaker"]) ??
        parent
          .querySelector("[data-caption-speaker], .NWpY1d, .caption-speaker")
          ?.textContent?.trim() ??
        "不明な話者";
      const speaker = resolveSpeakerName(parent, rawSpeaker);

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
