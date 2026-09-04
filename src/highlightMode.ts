import { focusRange } from "./highlightRange";

export type HighlightMode = "none" | "paragraph" | "sentence" | "headline";

export const DEFAULT_HIGHLIGHT_MODE: HighlightMode = "none";

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

export type HighlightGesture =
  | { type: "wheel" }
  | { type: "keydown"; key: string }
  | { type: "click" };

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

/**
 * Returns whether highlight painting should stay off after a user gesture.
 * Wheel suspends; a click or non-modifier key resumes.
 */
export function highlightSuspendedAfterGesture(
  suspended: boolean,
  gesture: HighlightGesture,
): boolean {
  switch (gesture.type) {
    case "wheel":
      return true;
    case "click":
      return false;
    case "keydown":
      return MODIFIER_KEYS.has(gesture.key) ? suspended : false;
  }
}

/**
 * Returns the mode to paint: `"none"` while temporarily suspended.
 */
export function highlightPaintMode(
  mode: HighlightMode,
  suspended: boolean,
): HighlightMode {
  return suspended && mode !== "none" ? "none" : mode;
}

export type HighlightModeBinding = {
  getHighlightMode: () => HighlightMode;
  setHighlightMode: (mode: HighlightMode) => void;
  disconnect: () => void;
};

export type HighlightSurface = {
  applyHighlightMode: (mode: HighlightMode) => void;
  onCaretOrDoc: (listener: () => void) => () => void;
  onWheel: (listener: () => void) => () => void;
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
  let suspended = false;

  const painted = (): HighlightMode => highlightPaintMode(mode, suspended);

  const paint = (): void => {
    paintHighlightOverlay(textarea, overlay, painted());
  };

  const applyPainted = (): void => {
    surface?.applyHighlightMode(painted());
    paint();
  };

  const applyGesture = (gesture: HighlightGesture): void => {
    if (mode === "none") {
      return;
    }
    const next = highlightSuspendedAfterGesture(suspended, gesture);
    if (next === suspended) {
      if (gesture.type !== "wheel") {
        paint();
      }
      return;
    }
    suspended = next;
    applyPainted();
  };

  const setHighlightMode = (next: HighlightMode): void => {
    mode = next;
    suspended = false;
    applyPainted();
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

  const onWheel = (): void => {
    applyGesture({ type: "wheel" });
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    applyGesture({ type: "keydown", key: event.key });
  };

  const onClick = (): void => {
    applyGesture({ type: "click" });
    onCaretMoved();
  };

  textarea.addEventListener("input", paint);
  textarea.addEventListener("click", onClick);
  textarea.addEventListener("keyup", onCaretMoved);
  textarea.addEventListener("scroll", paint);
  document.addEventListener("selectionchange", onCaretMoved);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("click", onClick, true);
  overlay.addEventListener("justpaper-highlight-mode", onHighlightEvent);
  const stopDoc = surface?.onCaretOrDoc(paint);
  const stopWheel = surface?.onWheel(onWheel);
  textarea.addEventListener("wheel", onWheel, { passive: true, capture: true });
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
      textarea.removeEventListener("click", onClick);
      textarea.removeEventListener("keyup", onCaretMoved);
      textarea.removeEventListener("scroll", paint);
      textarea.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("selectionchange", onCaretMoved);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick, true);
      overlay.removeEventListener("justpaper-highlight-mode", onHighlightEvent);
      stopDoc?.();
      stopWheel?.();
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
