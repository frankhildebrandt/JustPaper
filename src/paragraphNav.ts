import {
  activeParagraphIndex,
  paragraphRanges,
} from "./highlightRange";
import { pointerHitsScrollbar } from "./typewriter";

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

/**
 * Returns the paragraph index to highlight. A pointer offset from
 * scrolling wins over the caret.
 */
export function highlightedParagraphIndex(
  source: string,
  caret: number,
  pointerOffset: number | undefined,
): number {
  return activeParagraphIndex(source, pointerOffset ?? caret);
}

export type ParagraphNavSurface = {
  getDocument: () => string;
  getCaretOffset: () => number;
  setCaretOffset: (offset: number) => void;
  offsetAtClientPoint: (clientX: number, clientY: number) => number | undefined;
  scrollElement: () => HTMLElement;
  onScroll: (listener: () => void) => () => void;
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
 * to a paragraph start on click. User scrolling highlights the paragraph
 * under the pointer without moving the caret.
 */
export function bindParagraphNav(
  host: HTMLElement,
  surface: ParagraphNavSurface,
): ParagraphNavBinding {
  let enabled = DEFAULT_PARAGRAPH_NAV;
  let pointer: { x: number; y: number } | undefined;
  let pointerOffset: number | undefined;
  let followPointer = false;

  const paint = (): void => {
    if (!enabled) {
      host.hidden = true;
      host.replaceChildren();
      return;
    }

    host.hidden = false;
    const source = surface.getDocument();
    const ranges = paragraphRanges(source);
    const active = highlightedParagraphIndex(
      source,
      surface.getCaretOffset(),
      pointerOffset,
    );
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

  const applyPointerFocus = (): void => {
    if (!pointer) {
      return;
    }
    const scroller = surface.scrollElement();
    const rect = scroller.getBoundingClientRect();
    const paddingLeftPx = parseFloat(getComputedStyle(scroller).paddingLeft);
    const x = rect.left + paddingLeftPx + 4;
    const y = Math.min(Math.max(pointer.y, rect.top + 1), rect.bottom - 1);
    pointerOffset = surface.offsetAtClientPoint(x, y);
    paint();
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
    followPointer = false;
    pointerOffset = undefined;
    surface.setCaretOffset(range.from);
    surface.focus();
    surface.revealCaret();
    paint();
  };

  const onPointerMove = (event: PointerEvent): void => {
    pointer = { x: event.clientX, y: event.clientY };
  };

  const onWheel = (): void => {
    followPointer = true;
  };

  const onPointerDown = (event: PointerEvent): void => {
    const scroller = surface.scrollElement();
    const rect = scroller.getBoundingClientRect();
    if (
      pointerHitsScrollbar(
        event.clientX - rect.left,
        event.clientY - rect.top,
        scroller.clientWidth,
        scroller.clientHeight,
      )
    ) {
      followPointer = true;
    }
  };

  const onScroll = (): void => {
    if (!followPointer) {
      return;
    }
    applyPointerFocus();
  };

  const onCaretOrDoc = (): void => {
    followPointer = false;
    pointerOffset = undefined;
    paint();
  };

  host.addEventListener("click", onHostClick);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("wheel", onWheel, { passive: true, capture: true });
  const stopCaret = surface.onCaretOrDoc(onCaretOrDoc);
  const stopScroll = surface.onScroll(onScroll);
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
      stopScroll();
      host.removeEventListener("click", onHostClick);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("wheel", onWheel, true);
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
