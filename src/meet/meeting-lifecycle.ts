export type MeetingEndReason = "leave-button" | "meeting-ended";

export type MeetingLifecycleOptions = {
  document: Document;
  onEnd: (reason: MeetingEndReason) => void;
};

function elementLabel(element: Element): string {
  return [
    element.getAttribute("aria-label"),
    element.getAttribute("data-tooltip"),
    element.getAttribute("title"),
    element.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function isLeaveLabel(label: string): boolean {
  return /leave call|leave meeting|退出|退室/.test(label);
}

export function isMeetingJoined(document: Document): boolean {
  return [...document.querySelectorAll('button, [role="button"]')].some((element) =>
    isLeaveLabel(elementLabel(element)),
  );
}

function isMeetingEndedText(text: string): boolean {
  return /you(?:'|’)?ve left the meeting|meeting has ended|会議が終了|退出しました|会議から退出/.test(
    text.toLocaleLowerCase(),
  );
}

export class MeetingLifecycleObserver {
  private mutationObserver?: MutationObserver;
  private ended = false;

  constructor(private readonly options: MeetingLifecycleOptions) {}

  start(): void {
    this.options.document.addEventListener("click", this.onClick, true);
    if (this.options.document.body) {
      const MutationObserverClass =
        this.options.document.defaultView?.MutationObserver ?? globalThis.MutationObserver;
      if (!MutationObserverClass) return;
      this.mutationObserver = new MutationObserverClass(() => this.checkEndedText());
      this.mutationObserver.observe(this.options.document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      this.checkEndedText();
    }
  }

  stop(): void {
    this.options.document.removeEventListener("click", this.onClick, true);
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
  }

  private readonly onClick = (event: Event): void => {
    const target = event.target;
    const ElementClass = this.options.document.defaultView?.Element;
    if (!ElementClass || !(target instanceof ElementClass)) return;
    const button = target.closest('button, [role="button"]');
    if (button && isLeaveLabel(elementLabel(button))) this.emit("leave-button");
  };

  private checkEndedText(): void {
    const text = this.options.document.body?.innerText ?? "";
    if (isMeetingEndedText(text)) this.emit("meeting-ended");
  }

  private emit(reason: MeetingEndReason): void {
    if (this.ended) return;
    this.ended = true;
    this.options.onEnd(reason);
  }
}
