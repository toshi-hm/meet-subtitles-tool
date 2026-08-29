export type PanelStatus = "initialising" | "waiting" | "capturing" | "saving" | "saved" | "error";

export type FloatingPanelHandlers = {
  onCopy: () => Promise<void>;
  onDownload: () => Promise<void>;
  onDrive: () => Promise<void>;
};

export type PanelPosition = { left: number; top: number };

const HOST_ID = "meet-subtitles-floating-panel";

const styles = `
  :host { all: initial; color-scheme: light; font-family: Arial, sans-serif; }
  .panel { position: fixed; z-index: 2147483647; width: min(360px, calc(100vw - 24px)); color: #172033; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 8px 28px rgb(15 23 42 / 20%); }
  .header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: grab; border-bottom: 1px solid #e2e8f0; }
  .header:active { cursor: grabbing; }
  .title { flex: 1; font-size: 14px; font-weight: 700; }
  .count { color: #475569; font-size: 12px; }
  .collapse { border: 0; color: #334155; background: transparent; font-size: 18px; line-height: 1; cursor: pointer; }
  .body { display: grid; gap: 10px; padding: 12px; }
  .status { display: flex; align-items: center; gap: 6px; margin: 0; color: #475569; font-size: 12px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
  .dot[data-active="true"] { background: #16a34a; }
  .actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  button { min-height: 32px; border: 1px solid #cbd5e1; border-radius: 7px; color: #1e293b; background: #f8fafc; font: inherit; font-size: 12px; cursor: pointer; }
  button:hover { background: #e2e8f0; }
  button:focus-visible { outline: 3px solid #60a5fa; outline-offset: 2px; }
  .notice { min-height: 16px; margin: 0; color: #2563eb; font-size: 11px; }
  [hidden] { display: none; }
`;

export class FloatingPanel {
  private readonly host: HTMLDivElement;
  private readonly shadow: ShadowRoot;
  private readonly panel: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly status: HTMLSpanElement;
  private readonly dot: HTMLSpanElement;
  private readonly count: HTMLSpanElement;
  private readonly notice: HTMLParagraphElement;
  private collapsed = false;
  private dragState?: { offsetX: number; offsetY: number };

  constructor(
    private readonly document: Document,
    private readonly handlers: FloatingPanelHandlers,
    position: PanelPosition = { left: 24, top: 96 },
  ) {
    document.getElementById(HOST_ID)?.remove();
    this.host = document.createElement("div");
    this.host.id = HOST_ID;
    this.shadow = this.host.attachShadow({ mode: "open" });
    this.shadow.innerHTML = `<style>${styles}</style><section class="panel" role="region" aria-label="Meet Subtitles"><header class="header"><span class="title">Meet Subtitles</span><span class="count" aria-live="polite">0件</span><button class="collapse" type="button" aria-label="字幕パネルを折りたたむ" aria-expanded="true">−</button></header><div class="body"><p class="status" role="status"><span class="dot" aria-hidden="true"></span><span>準備しています</span></p><div class="actions"><button type="button" data-action="copy">コピー</button><button type="button" data-action="download">TXT保存</button><button type="button" data-action="drive">Drive保存</button></div><p class="notice" role="status" aria-live="polite"></p></div></section>`;
    this.panel = this.shadow.querySelector(".panel") as HTMLDivElement;
    this.body = this.shadow.querySelector(".body") as HTMLDivElement;
    this.status = this.shadow.querySelector(".status span:last-child") as HTMLSpanElement;
    this.dot = this.shadow.querySelector(".dot") as HTMLSpanElement;
    this.count = this.shadow.querySelector(".count") as HTMLSpanElement;
    this.notice = this.shadow.querySelector(".notice") as HTMLParagraphElement;
    this.setPosition(position);
    this.bindEvents();
    (document.body ?? document.documentElement).append(this.host);
  }

  update(status: PanelStatus, count: number): void {
    const labels: Record<PanelStatus, string> = {
      initialising: "準備しています",
      waiting: "字幕をONにしています",
      capturing: "字幕取得中",
      saving: "保存中",
      saved: "保存しました",
      error: "エラーが発生しました",
    };
    this.status.textContent = labels[status];
    this.dot.dataset.active = String(status === "capturing" || status === "saving");
    this.count.textContent = `${count}件`;
  }

  notify(message: string): void {
    this.notice.textContent = message;
  }

  getPosition(): PanelPosition {
    return { left: this.panel.offsetLeft, top: this.panel.offsetTop };
  }

  destroy(): void {
    this.host.remove();
  }

  private setPosition(position: PanelPosition): void {
    this.panel.style.left = `${Math.max(8, position.left)}px`;
    this.panel.style.top = `${Math.max(8, position.top)}px`;
  }

  private bindEvents(): void {
    this.shadow
      .querySelector('[data-action="copy"]')
      ?.addEventListener("click", () => this.runAction(this.handlers.onCopy));
    this.shadow
      .querySelector('[data-action="download"]')
      ?.addEventListener("click", () => this.runAction(this.handlers.onDownload));
    this.shadow
      .querySelector('[data-action="drive"]')
      ?.addEventListener("click", () => this.runAction(this.handlers.onDrive));
    this.shadow.querySelector(".collapse")?.addEventListener("click", (event) => {
      this.collapsed = !this.collapsed;
      this.body.hidden = this.collapsed;
      const button = event.currentTarget as HTMLButtonElement;
      button.ariaExpanded = String(!this.collapsed);
      button.ariaLabel = this.collapsed ? "字幕パネルを展開する" : "字幕パネルを折りたたむ";
      button.textContent = this.collapsed ? "+" : "−";
    });

    const header = this.shadow.querySelector(".header") as HTMLElement | null;
    header?.addEventListener("pointerdown", (event) => {
      const pointer = event as PointerEvent;
      const rect = this.panel.getBoundingClientRect();
      this.dragState = {
        offsetX: pointer.clientX - rect.left,
        offsetY: pointer.clientY - rect.top,
      };
      header.setPointerCapture?.(pointer.pointerId);
    });
    header?.addEventListener("pointermove", (event) => {
      if (!this.dragState) return;
      const pointer = event as PointerEvent;
      const left = pointer.clientX - this.dragState.offsetX;
      const top = pointer.clientY - this.dragState.offsetY;
      this.setPosition({ left, top });
    });
    header?.addEventListener("pointerup", () => {
      this.dragState = undefined;
    });
  }

  private async runAction(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.notify(error instanceof Error ? error.message : "操作に失敗しました");
    }
  }
}
