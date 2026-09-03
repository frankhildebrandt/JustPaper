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
  filenameHeightPx?: number,
): VerticalPaddingPx {
  if (mode === "typewriter") {
    const originPx = verticalOriginPaddingPx(editorHeightPx, lineHeightPx);
    return { top: originPx, bottom: originPx };
  }
  return {
    top: lineHeightPx / 2 + filenameReservePx(lineHeightPx, filenameHeightPx),
    bottom: 0,
  };
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
  setFilenameHeight: (heightPx: number) => void;
  refreshLayout: () => void;
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
  let filenameHeightPx = 0;
  let host = initialHost;
  const hostListeners = new Set<() => void>();
  const layoutListeners = new Set<() => void>();
  const padding = (
    editorHeightPx: number,
    lineHeightPx: number,
  ): VerticalPaddingPx =>
    verticalPaddingPx(
      mode,
      editorHeightPx,
      lineHeightPx,
      filenameHeightPx > 0 ? filenameHeightPx : undefined,
    );
  let layout = bindPageLayout(
    host.layoutElement,
    padding,
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
    layout = bindPageLayout(host.layoutElement, padding, () =>
      fontSizeScale(fontSize),
    );
    syncTypewriter();
  };

  const refreshLayout = (): void => {
    layout.apply();
    notifyLayout();
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
      refreshLayout();
      syncTypewriter();
    },
    getFontSize: () => fontSize,
    setFontSize: (next: FontSize): void => {
      if (next === fontSize) {
        return;
      }
      fontSize = next;
      refreshLayout();
    },
    setFilenameHeight: (heightPx: number): void => {
      if (heightPx === filenameHeightPx) {
        return;
      }
      filenameHeightPx = heightPx;
      refreshLayout();
    },
    refreshLayout,
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
