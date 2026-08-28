import { scrollTopToCenterLine } from "./pageLayout";

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

const MIRROR_STYLES = [
  "font",
  "letterSpacing",
  "wordSpacing",
  "textTransform",
  "textIndent",
  "tabSize",
  "wordBreak",
  "overflowWrap",
  "whiteSpace",
] as const;

/**
 * Measures the caret line's Y offset from the top of the textarea's
 * scrollable content, including origin padding.
 */
export function measureCaretTopPx(textarea: HTMLTextAreaElement): number {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  for (const property of MIRROR_STYLES) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.padding = "0";
  const wrapWidthPx =
    textarea.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight);
  mirror.style.width = `${wrapWidthPx}px`;

  const beforeCaret = textarea.value.slice(0, textarea.selectionEnd);
  mirror.textContent = beforeCaret;
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(marker);
  document.body.append(mirror);
  const lineOffsetPx = marker.offsetTop;
  mirror.remove();

  return parseFloat(style.paddingTop) + lineOffsetPx;
}

/**
 * Returns the document offset whose line sits under `clientY` in the textarea.
 */
export function textareaOffsetAtClientPoint(
  textarea: HTMLTextAreaElement,
  clientY: number,
): number {
  const source = textarea.value;
  if (source.length === 0) {
    return 0;
  }

  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  for (const property of MIRROR_STYLES) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }
  const rect = textarea.getBoundingClientRect();
  const paddingLeftPx = parseFloat(style.paddingLeft);
  const paddingTopPx = parseFloat(style.paddingTop);
  const wrapWidthPx =
    textarea.clientWidth - paddingLeftPx - parseFloat(style.paddingRight);
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.padding = "0";
  mirror.style.width = `${wrapWidthPx}px`;
  mirror.style.left = `${rect.left + paddingLeftPx}px`;
  mirror.style.top = `${rect.top + paddingTopPx - textarea.scrollTop}px`;
  mirror.textContent = source;
  document.body.append(mirror);
  const textNode = mirror.firstChild;
  if (!(textNode instanceof Text)) {
    mirror.remove();
    return 0;
  }

  let low = 0;
  let high = source.length;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    const range = document.createRange();
    range.setStart(textNode, Math.min(mid, textNode.length));
    range.collapse(true);
    if (range.getBoundingClientRect().top <= clientY) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  mirror.remove();
  return low;
}

export type TypewriterFollow = "follow" | "released";

export type TypewriterGesture =
  | { type: "wheel" }
  | { type: "scroll" }
  | { type: "pointerdown"; button: number; onScrollbar: boolean }
  | { type: "click"; button: number; onScrollbar: boolean }
  | { type: "keydown"; key: string };

export type TypewriterTarget = {
  scrollElement: HTMLElement;
  isFocused: () => boolean;
  measureCaretTopPx: () => number;
  onCaretMoved: (handler: () => void) => () => void;
};

/**
 * Returns whether a point in scroller-local coordinates sits on a scrollbar.
 */
export function pointerHitsScrollbar(
  localX: number,
  localY: number,
  clientWidth: number,
  clientHeight: number,
): boolean {
  return localX >= clientWidth || localY >= clientHeight;
}

/**
 * Returns the typewriter follow state after a user gesture.
 * Wheel, scroll, and mouse clicks release follow until a key press.
 */
export function typewriterFollowAfterGesture(
  follow: TypewriterFollow,
  gesture: TypewriterGesture,
): TypewriterFollow {
  switch (gesture.type) {
    case "wheel":
    case "scroll":
    case "pointerdown":
    case "click":
      return "released";
    case "keydown":
      return MODIFIER_KEYS.has(gesture.key) ? follow : "follow";
  }
}

/**
 * Adapts a textarea to the typewriter scroll host.
 */
export function textareaTypewriterTarget(
  textarea: HTMLTextAreaElement,
): TypewriterTarget {
  return {
    scrollElement: textarea,
    isFocused: () => document.activeElement === textarea,
    measureCaretTopPx: () => measureCaretTopPx(textarea),
    onCaretMoved: (handler: () => void): (() => void) => {
      textarea.addEventListener("input", handler);
      textarea.addEventListener("click", handler);
      textarea.addEventListener("keyup", handler);
      document.addEventListener("selectionchange", handler);
      return () => {
        textarea.removeEventListener("input", handler);
        textarea.removeEventListener("click", handler);
        textarea.removeEventListener("keyup", handler);
        document.removeEventListener("selectionchange", handler);
      };
    },
  };
}

/**
 * Scrolls so the caret line at `caretTopPx` sits on the vertical center.
 */
export function revealCaretLine(
  scrollElement: HTMLElement,
  caretTopPx: number,
): void {
  const lineHeightPx = parseFloat(getComputedStyle(scrollElement).lineHeight);
  scrollElement.scrollTop = Math.max(
    0,
    scrollTopToCenterLine(
      caretTopPx,
      scrollElement.clientHeight,
      lineHeightPx,
    ),
  );
}

/**
 * Keeps the caret line centered until the user scrolls or clicks, then waits
 * for keyboard input before following again.
 */
export function bindTypewriterScroll(target: TypewriterTarget): () => void {
  let follow: TypewriterFollow = "follow";
  let ignoreScroll = false;
  const { scrollElement } = target;

  const centerCaretLine = (): void => {
    if (follow !== "follow") {
      return;
    }
    const lineHeightPx = parseFloat(getComputedStyle(scrollElement).lineHeight);
    const caretTopPx = target.measureCaretTopPx();
    const nextScrollTop = Math.max(
      0,
      scrollTopToCenterLine(
        caretTopPx,
        scrollElement.clientHeight,
        lineHeightPx,
      ),
    );
    if (Math.abs(scrollElement.scrollTop - nextScrollTop) < 1) {
      return;
    }
    ignoreScroll = true;
    scrollElement.scrollTop = nextScrollTop;
  };

  const onScrollbar = (event: PointerEvent | MouseEvent): boolean => {
    const rect = scrollElement.getBoundingClientRect();
    return pointerHitsScrollbar(
      event.clientX - rect.left,
      event.clientY - rect.top,
      scrollElement.clientWidth,
      scrollElement.clientHeight,
    );
  };

  const applyGesture = (gesture: TypewriterGesture): void => {
    const next = typewriterFollowAfterGesture(follow, gesture);
    const resume = follow === "released" && next === "follow";
    follow = next;
    if (resume) {
      centerCaretLine();
    }
  };

  const onWheel = (): void => {
    ignoreScroll = false;
    applyGesture({ type: "wheel" });
  };

  const onScroll = (): void => {
    if (ignoreScroll) {
      ignoreScroll = false;
      return;
    }
    applyGesture({ type: "scroll" });
  };

  const onPointerDown = (event: PointerEvent): void => {
    applyGesture({
      type: "pointerdown",
      button: event.button,
      onScrollbar: onScrollbar(event),
    });
  };

  const onClick = (event: MouseEvent): void => {
    applyGesture({
      type: "click",
      button: event.button,
      onScrollbar: onScrollbar(event),
    });
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    applyGesture({ type: "keydown", key: event.key });
    if (!MODIFIER_KEYS.has(event.key)) {
      ignoreScroll = true;
    }
  };

  const onCaretMoved = (): void => {
    if (!target.isFocused()) {
      return;
    }
    centerCaretLine();
  };

  const unbindCaret = target.onCaretMoved(onCaretMoved);
  const capturing: AddEventListenerOptions = { capture: true };
  scrollElement.addEventListener("wheel", onWheel, {
    passive: true,
    capture: true,
  });
  scrollElement.addEventListener("pointerdown", onPointerDown, capturing);
  scrollElement.addEventListener("click", onClick, capturing);
  scrollElement.addEventListener("keydown", onKeyDown, capturing);
  scrollElement.addEventListener("scroll", onScroll);
  const observer = new ResizeObserver(centerCaretLine);
  observer.observe(scrollElement);
  centerCaretLine();

  return () => {
    observer.disconnect();
    unbindCaret();
    scrollElement.removeEventListener("wheel", onWheel, capturing);
    scrollElement.removeEventListener("pointerdown", onPointerDown, capturing);
    scrollElement.removeEventListener("click", onClick, capturing);
    scrollElement.removeEventListener("keydown", onKeyDown, capturing);
    scrollElement.removeEventListener("scroll", onScroll);
  };
}
