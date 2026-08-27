import { filenameReservePx } from "./filenameLayout";
import {
  bindPageLayout,
  verticalOriginPaddingPx,
  type VerticalPaddingPx,
} from "./pageLayout";
import { fontSizeScale, type FontSize } from "./settings";
import {
  bindTypewriterScroll,
  textareaTypewriterTarget,
  type TypewriterTarget,
} from "./typewriter";

export type LayoutHost = {
  layoutElement: HTMLElement;
  typewriter?: TypewriterTarget;
};

export type ViewMode = "normal" | "typewriter";

export const DEFAULT_VIEW_MODE: ViewMode = "typewriter";

/**
 * Returns vertical textarea padding for the given view mode.
 */
export function verticalPaddingPx(
  mode: ViewMode,
  editorHeightPx: number,
  lineHeightPx: number,
): VerticalPaddingPx {
  if (mode === "typewriter") {
    const originPx = verticalOriginPaddingPx(editorHeightPx, lineHeightPx);
    return { top: originPx, bottom: originPx };
  }
  return { top: lineHeightPx / 2 + filenameReservePx(lineHeightPx), bottom: 0 };
}

/**
 * Returns which view-mode menu items should be checked.
 */
export function checkedViewModeItems(mode: ViewMode): {
  normal: boolean;
  typewriter: boolean;
} {
  return {
    normal: mode === "normal",
    typewriter: mode === "typewriter",
  };
}

export type ViewModeBinding = {
  getViewMode: () => ViewMode;
  setViewMode: (mode: ViewMode) => void;
  getFontSize: () => FontSize;
  setFontSize: (size: FontSize) => void;
  getHost: () => LayoutHost;
  setHost: (host: LayoutHost) => void;
  onHostChange: (listener: () => void) => () => void;
  onLayoutChange: (listener: () => void) => () => void;
  disconnect: () => void;
};

/**
 * Binds page layout and typewriter scroll to a textarea.
 */
export function textareaLayoutHost(
  textarea: HTMLTextAreaElement,
): LayoutHost {
  return {
    layoutElement: textarea,
    typewriter: textareaTypewriterTarget(textarea),
  };
}

/**
 * Applies view-mode padding and binds typewriter scroll only in typewriter mode.
 */
export function bindViewMode(initialHost: LayoutHost): ViewModeBinding {
  let mode: ViewMode = DEFAULT_VIEW_MODE;
  let fontSize: FontSize = "l";
  let host = initialHost;
  const hostListeners = new Set<() => void>();
  const layoutListeners = new Set<() => void>();
  let layout = bindPageLayout(
    host.layoutElement,
    (editorHeightPx, lineHeightPx) =>
      verticalPaddingPx(mode, editorHeightPx, lineHeightPx),
    () => fontSizeScale(fontSize),
  );
  let unbindTypewriter: (() => void) | undefined;

  const syncTypewriter = (): void => {
    unbindTypewriter?.();
    unbindTypewriter = undefined;
    if (mode === "typewriter" && host.typewriter) {
      unbindTypewriter = bindTypewriterScroll(host.typewriter);
    }
  };

  const bindLayout = (): void => {
    layout = bindPageLayout(
      host.layoutElement,
      (editorHeightPx, lineHeightPx) =>
        verticalPaddingPx(mode, editorHeightPx, lineHeightPx),
      () => fontSizeScale(fontSize),
    );
    syncTypewriter();
  };

  const notifyLayout = (): void => {
    for (const listener of layoutListeners) {
      listener();
    }
  };

  syncTypewriter();

  return {
    getViewMode: () => mode,
    setViewMode: (next: ViewMode): void => {
      if (next === mode) {
        return;
      }
      unbindTypewriter?.();
      unbindTypewriter = undefined;
      mode = next;
      layout.apply();
      syncTypewriter();
      notifyLayout();
    },
    getFontSize: () => fontSize,
    setFontSize: (next: FontSize): void => {
      if (next === fontSize) {
        return;
      }
      fontSize = next;
      layout.apply();
      notifyLayout();
    },
    getHost: () => host,
    setHost: (next: LayoutHost): void => {
      unbindTypewriter?.();
      unbindTypewriter = undefined;
      layout.disconnect();
      host = next;
      bindLayout();
      for (const listener of hostListeners) {
        listener();
      }
    },
    onHostChange: (listener: () => void): (() => void) => {
      hostListeners.add(listener);
      return () => {
        hostListeners.delete(listener);
      };
    },
    onLayoutChange: (listener: () => void): (() => void) => {
      layoutListeners.add(listener);
      return () => {
        layoutListeners.delete(listener);
      };
    },
    disconnect: (): void => {
      unbindTypewriter?.();
      layout.disconnect();
      hostListeners.clear();
      layoutListeners.clear();
    },
  };
}
