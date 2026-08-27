export const LINE_CAPACITY = 65;

export type VerticalPaddingPx = {
  top: number;
  bottom: number;
};

/**
 * Returns the wrap width inside a padded textarea, matching the previous
 * full-width measurement (`clientWidth - 1`) when padding is zero.
 */
export function contentWidthPx(
  clientWidthPx: number,
  paddingLeftPx: number,
  paddingRightPx: number,
): number {
  return Math.max(0, clientWidthPx - paddingLeftPx - paddingRightPx - 1);
}

/**
 * Returns the font size in pixels so that `LINE_CAPACITY` monospace glyphs
 * fill `availableWidthPx` at scale 1. Named sizes multiply that auto-fit.
 */
export function fontSizeForLineCapacity(
  availableWidthPx: number,
  charWidthAt1px: number,
  scale: number = 1,
): number {
  return (availableWidthPx / (LINE_CAPACITY * charWidthAt1px)) * scale;
}

/**
 * Returns top padding so the first line sits on the vertical center of the page.
 */
export function verticalOriginPaddingPx(
  editorHeightPx: number,
  lineHeightPx: number,
): number {
  return (editorHeightPx - lineHeightPx) / 2;
}

/**
 * Returns the scroll offset that places a caret line at `caretTopPx`
 * onto the vertical center of the page.
 */
export function scrollTopToCenterLine(
  caretTopPx: number,
  editorHeightPx: number,
  lineHeightPx: number,
): number {
  return caretTopPx - verticalOriginPaddingPx(editorHeightPx, lineHeightPx);
}

/**
 * Measures the width of one monospace glyph when the font size is 1px.
 */
export function measureCharWidthAt1px(fontFamily: string): number {
  const sampleSizePx = 100;
  const probe = document.createElement("span");
  probe.textContent = "M".repeat(LINE_CAPACITY);
  probe.style.cssText = [
    "position: absolute",
    "visibility: hidden",
    "white-space: pre",
    `font: ${sampleSizePx}px ${fontFamily}`,
  ].join(";");
  document.body.append(probe);
  const lineWidthPx = probe.getBoundingClientRect().width;
  probe.remove();
  return lineWidthPx / (LINE_CAPACITY * sampleSizePx);
}

export type PageLayout = {
  apply: () => void;
  disconnect: () => void;
};

/**
 * Keeps the editor font sized so a manuscript line always fills the page.
 */
export function bindPageLayout(
  element: HTMLElement,
  verticalPadding: (
    editorHeightPx: number,
    lineHeightPx: number,
  ) => VerticalPaddingPx,
  fontScale: () => number = () => 1,
): PageLayout {
  let charWidthAt1px = 0.6;
  let disconnected = false;

  const apply = (): void => {
    if (element.clientWidth === 0) {
      return;
    }
    const style = getComputedStyle(element);
    const availableWidthPx = contentWidthPx(
      element.clientWidth,
      parseFloat(style.paddingLeft),
      parseFloat(style.paddingRight),
    );
    const fontSizePx = fontSizeForLineCapacity(
      availableWidthPx,
      charWidthAt1px,
      fontScale(),
    );
    element.style.fontSize = `${fontSizePx}px`;
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${fontSizePx}px`,
    );
    const lineHeightPx = parseFloat(getComputedStyle(element).lineHeight);
    const padding = verticalPadding(element.clientHeight, lineHeightPx);
    element.style.paddingTop = `${padding.top}px`;
    element.style.paddingBottom = `${padding.bottom}px`;
  };

  const observer = new ResizeObserver(apply);
  observer.observe(element);
  apply();

  void document.fonts.ready.then(() => {
    if (disconnected) {
      return;
    }
    charWidthAt1px = measureCharWidthAt1px(
      getComputedStyle(element).fontFamily,
    );
    apply();
  });

  return {
    apply,
    disconnect: () => {
      disconnected = true;
      observer.disconnect();
    },
  };
}
