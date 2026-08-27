import { focusRange } from "./highlightRange";

export type HighlightMode = "none" | "paragraph" | "sentence" | "headline";

export const DEFAULT_HIGHLIGHT_MODE: HighlightMode = "none";

export type CheckedHighlightModeItems = {
  none: boolean;
  paragraph: boolean;
  sentence: boolean;
  headline: boolean;
};

/**
 * Returns which highlight-mode menu items should be checked.
 */
export function checkedHighlightModeItems(
  mode: HighlightMode,
): CheckedHighlightModeItems {
  return {
    none: mode === "none",
    paragraph: mode === "paragraph",
    sentence: mode === "sentence",
    headline: mode === "headline",
  };
}

export type HighlightModeBinding = {
  getHighlightMode: () => HighlightMode;
  setHighlightMode: (mode: HighlightMode) => void;
  disconnect: () => void;
};

export type HighlightSurface = {
  applyHighlightMode: (mode: HighlightMode) => void;
  onCaretOrDoc: (listener: () => void) => () => void;
};

/**
 * Dims text outside the caret's focus range via an overlay behind the
 * textarea and matching decorations on the markdown surface.
 */
export function bindHighlightMode(
  textarea: HTMLTextAreaElement,
  overlay: HTMLElement,
  surface?: HighlightSurface,
): HighlightModeBinding {
  let mode: HighlightMode = DEFAULT_HIGHLIGHT_MODE;

  const paint = (): void => {
    paintHighlightOverlay(textarea, overlay, mode);
  };

  const setHighlightMode = (next: HighlightMode): void => {
    mode = next;
    surface?.applyHighlightMode(next);
    paint();
  };

  const onHighlightEvent = (event: Event): void => {
    const next = (event as CustomEvent<unknown>).detail;
    if (isHighlightMode(next)) {
      setHighlightMode(next);
    }
  };

  const onCaretMoved = (): void => {
    if (document.activeElement !== textarea && mode === "none") {
      return;
    }
    paint();
  };

  textarea.addEventListener("input", paint);
  textarea.addEventListener("click", onCaretMoved);
  textarea.addEventListener("keyup", onCaretMoved);
  textarea.addEventListener("scroll", paint);
  document.addEventListener("selectionchange", onCaretMoved);
  overlay.addEventListener("justpaper-highlight-mode", onHighlightEvent);
  const stopDoc = surface?.onCaretOrDoc(paint);
  const observer = new ResizeObserver(paint);
  observer.observe(textarea);
  const hiddenObserver = new MutationObserver(paint);
  hiddenObserver.observe(textarea, { attributes: true, attributeFilter: ["hidden"] });
  paint();

  return {
    getHighlightMode: () => mode,
    setHighlightMode,
    disconnect: (): void => {
      observer.disconnect();
      hiddenObserver.disconnect();
      textarea.removeEventListener("input", paint);
      textarea.removeEventListener("click", onCaretMoved);
      textarea.removeEventListener("keyup", onCaretMoved);
      textarea.removeEventListener("scroll", paint);
      document.removeEventListener("selectionchange", onCaretMoved);
      overlay.removeEventListener("justpaper-highlight-mode", onHighlightEvent);
      stopDoc?.();
    },
  };
}

function isHighlightMode(value: unknown): value is HighlightMode {
  return (
    value === "none" ||
    value === "paragraph" ||
    value === "sentence" ||
    value === "headline"
  );
}

/**
 * Paints dim/focus spans to match the textarea wrap, or hides the overlay
 * when nothing should be dimmed.
 */
function paintHighlightOverlay(
  textarea: HTMLTextAreaElement,
  overlay: HTMLElement,
  mode: HighlightMode,
): void {
  const source = textarea.value;
  const focus =
    textarea.hidden || mode === "none"
      ? undefined
      : focusRange(source, textarea.selectionEnd, mode);

  if (!focus || (focus.from <= 0 && focus.to >= source.length)) {
    overlay.hidden = true;
    overlay.replaceChildren();
    textarea.classList.remove("is-highlight");
    return;
  }

  textarea.classList.add("is-highlight");
  overlay.hidden = false;
  syncOverlayMetrics(overlay, textarea);

  const nodes: HTMLSpanElement[] = [];
  if (focus.from > 0) {
    nodes.push(textSpan("highlight-dim", source.slice(0, focus.from)));
  }
  nodes.push(textSpan("highlight-focus", source.slice(focus.from, focus.to)));
  if (focus.to < source.length) {
    nodes.push(textSpan("highlight-dim", source.slice(focus.to)));
  }
  overlay.replaceChildren(...nodes);
  overlay.scrollTop = textarea.scrollTop;
}

function textSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

/**
 * Copies wrap-critical metrics so overlay glyphs sit under the textarea.
 */
function syncOverlayMetrics(
  overlay: HTMLElement,
  textarea: HTMLTextAreaElement,
): void {
  const style = getComputedStyle(textarea);
  overlay.style.font = style.font;
  overlay.style.lineHeight = style.lineHeight;
  overlay.style.letterSpacing = style.letterSpacing;
  overlay.style.tabSize = style.tabSize;
  overlay.style.whiteSpace = style.whiteSpace;
  overlay.style.overflowWrap = style.overflowWrap;
  overlay.style.wordBreak = style.wordBreak;
  overlay.style.paddingTop = style.paddingTop;
  overlay.style.paddingBottom = style.paddingBottom;
  overlay.style.paddingLeft = style.paddingLeft;
  const scrollbarPx = textarea.offsetWidth - textarea.clientWidth;
  overlay.style.paddingRight = `${parseFloat(style.paddingRight) + scrollbarPx}px`;
}
