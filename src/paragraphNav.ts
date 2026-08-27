import {
  activeParagraphIndex,
  paragraphRanges,
} from "./highlightRange";

export const DEFAULT_PARAGRAPH_NAV = true;

export const TICK_HEIGHT_PX = 2;
export const TICK_GAP_PX = 8;
export const TICK_INSET_PX = 12;

export type TickLayout = {
  count: number;
  viewHeightPx: number;
  tickHeightPx: number;
  gapPx: number;
  insetPx: number;
};

/**
 * Returns the top offset of each equally spaced tick, centered in the view.
 * Overflow compresses the gap evenly, never below zero.
 */
export function tickTopsPx(layout: TickLayout): number[] {
  const { count, viewHeightPx, tickHeightPx, insetPx } = layout;
  if (count <= 0) {
    return [];
  }

  const availablePx = Math.max(0, viewHeightPx - 2 * insetPx);
  let gapPx = layout.gapPx;
  const preferredPx = count * tickHeightPx + Math.max(0, count - 1) * gapPx;
  if (count > 1 && preferredPx > availablePx) {
    gapPx = Math.max(0, (availablePx - count * tickHeightPx) / (count - 1));
  }

  const clusterPx = count * tickHeightPx + Math.max(0, count - 1) * gapPx;
  const startPx = (viewHeightPx - clusterPx) / 2;
  const stridePx = tickHeightPx + gapPx;
  return Array.from({ length: count }, (_, index) => startPx + index * stridePx);
}

/**
 * Returns whether the Absatzmarkierungen menu item should be checked.
 */
export function checkedParagraphNav(enabled: boolean): { paragraphNav: boolean } {
  return { paragraphNav: enabled };
}

export type ParagraphNavSurface = {
  getDocument: () => string;
  getCaretOffset: () => number;
  setCaretOffset: (offset: number) => void;
  revealCaret: () => void;
  focus: () => void;
  onCaretOrDoc: (listener: () => void) => () => void;
};

export type ParagraphNavBinding = {
  isEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  disconnect: () => void;
};

/**
 * Renders equally spaced paragraph ticks in `host` and jumps the caret
 * to a paragraph start on click.
 */
export function bindParagraphNav(
  host: HTMLElement,
  surface: ParagraphNavSurface,
): ParagraphNavBinding {
  let enabled = DEFAULT_PARAGRAPH_NAV;

  const paint = (): void => {
    if (!enabled) {
      host.hidden = true;
      host.replaceChildren();
      return;
    }

    host.hidden = false;
    const source = surface.getDocument();
    const ranges = paragraphRanges(source);
    const active = activeParagraphIndex(source, surface.getCaretOffset());
    const tops = tickTopsPx({
      count: ranges.length,
      viewHeightPx: host.clientHeight,
      tickHeightPx: TICK_HEIGHT_PX,
      gapPx: TICK_GAP_PX,
      insetPx: TICK_INSET_PX,
    });

    const nodes = tops.map((topPx, index) => {
      const nextTop = tops[index + 1];
      const heightPx = nextTop === undefined ? TICK_HEIGHT_PX + TICK_GAP_PX : nextTop - topPx;
      return tickButton(index, topPx, heightPx, index === active);
    });
    host.replaceChildren(...nodes);
  };

  const onHostClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement | null)?.closest(
      "button.paragraph-tick",
    );
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    event.preventDefault();
    const index = Number(button.dataset.index);
    const range = paragraphRanges(surface.getDocument())[index];
    if (!range) {
      return;
    }
    surface.setCaretOffset(range.from);
    surface.focus();
    surface.revealCaret();
    paint();
  };

  host.addEventListener("click", onHostClick);
  const stopCaret = surface.onCaretOrDoc(paint);
  const observer = new ResizeObserver(paint);
  observer.observe(host);
  paint();

  return {
    isEnabled: () => enabled,
    setEnabled: (next: boolean): void => {
      enabled = next;
      paint();
    },
    disconnect: (): void => {
      observer.disconnect();
      stopCaret();
      host.removeEventListener("click", onHostClick);
    },
  };
}

function tickButton(
  index: number,
  topPx: number,
  heightPx: number,
  active: boolean,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = active ? "paragraph-tick is-active" : "paragraph-tick";
  button.style.top = `${topPx}px`;
  button.style.height = `${Math.max(heightPx, TICK_HEIGHT_PX)}px`;
  button.dataset.index = String(index);
  button.setAttribute("aria-label", `Absatz ${index + 1}`);
  button.tabIndex = -1;
  return button;
}
