import type { CaptionCandidate } from "../domain/types";
import { extractCaptionCandidates, findCaptionRoots } from "./caption-dom";

export type CaptionObserverOptions = {
  document: Document;
  onCaption: (candidate: CaptionCandidate) => void;
  now?: () => number;
};

export class MeetCaptionObserver {
  private readonly now: () => number;
  private readonly rootKeys = new WeakMap<Element, string>();
  private rootSequence = 0;
  private mutationObserver?: MutationObserver;
  private scanTimer?: number;

  constructor(private readonly options: CaptionObserverOptions) {
    this.now = options.now ?? Date.now;
  }

  start(): void {
    this.scan();
    if (!this.options.document.body) return;

    this.mutationObserver = new MutationObserver(() => this.scheduleScan());
    this.mutationObserver.observe(this.options.document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "data-caption", "data-caption-text", "data-speaker"],
    });
  }

  stop(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    if (this.scanTimer !== undefined) window.clearTimeout(this.scanTimer);
    this.scanTimer = undefined;
  }

  private scheduleScan(): void {
    if (this.scanTimer !== undefined) return;
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = undefined;
      this.scan();
    }, 0);
  }

  private scan(): void {
    for (const root of findCaptionRoots(this.options.document)) {
      const rootKey = this.getRootKey(root);
      for (const candidate of extractCaptionCandidates(root, this.now())) {
        const sourceKey = candidate.sourceKey.startsWith("caption-")
          ? `${rootKey}-${candidate.sourceKey}`
          : candidate.sourceKey;
        this.options.onCaption({ ...candidate, sourceKey });
      }
    }
  }

  private getRootKey(root: Element): string {
    const existing = this.rootKeys.get(root);
    if (existing) return existing;
    const key = `dom-root-${this.rootSequence++}`;
    this.rootKeys.set(root, key);
    return key;
  }
}
