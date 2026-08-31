import { getCurrentWindow } from "@tauri-apps/api/window";

export const WINDOW_CONTROLS_EDGE_PX = 40;
const VISIBLE_CLASS = "is-visible";
const FULLSCREEN_CLASS = "is-fullscreen";
const MAXIMIZED_CLASS = "is-maximized";

export type ZoomAction = "fullscreen" | "maximize";

/**
 * Returns whether the pointer is in the top chrome hover strip.
 */
export function windowControlsVisible(
  mouseY: number,
  threshold: number = WINDOW_CONTROLS_EDGE_PX,
): boolean {
  return mouseY <= threshold;
}

/**
 * True when the UI should use Windows caption chrome.
 */
export function isWindowsChrome(
  userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  return /Windows/i.test(userAgent);
}

/**
 * Marks the document root for Windows vs macOS chrome CSS.
 */
export function applyChromePlatform(
  root: HTMLElement = document.documentElement,
): void {
  if (isWindowsChrome()) {
    root.dataset.chrome = "windows";
  } else {
    delete root.dataset.chrome;
  }
}

/**
 * Maps a green-button click: Option maximizes on macOS; Windows always maximizes.
 */
export function zoomAction(
  altKey: boolean,
  windows: boolean = false,
): ZoomAction {
  if (windows) {
    return "maximize";
  }
  return altKey ? "maximize" : "fullscreen";
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export type WindowChromeOptions = {
  threshold?: number;
  reveal?: HTMLElement[];
  onChange?: (visible: boolean) => void;
};

/**
 * Reveals the window controls while the pointer stays at the top edge.
 */
export function bindWindowChrome(
  root: HTMLElement,
  controls: HTMLElement,
  options: WindowChromeOptions = {},
): () => void {
  const threshold = options.threshold ?? WINDOW_CONTROLS_EDGE_PX;
  const reveal = options.reveal ?? [];

  const setVisible = (visible: boolean): void => {
    controls.classList.toggle(VISIBLE_CLASS, visible);
    for (const element of reveal) {
      element.classList.toggle(VISIBLE_CLASS, visible);
    }
    options.onChange?.(visible);
  };

  const onMove = (event: MouseEvent): void => {
    setVisible(windowControlsVisible(event.clientY, threshold));
  };
  const onLeave = (): void => setVisible(false);

  setVisible(false);
  root.addEventListener("mousemove", onMove);
  root.addEventListener("mouseleave", onLeave);

  return () => {
    root.removeEventListener("mousemove", onMove);
    root.removeEventListener("mouseleave", onLeave);
  };
}

/**
 * Wires traffic lights / Windows caption buttons to the current Tauri window.
 */
export function bindTrafficLights(buttons: {
  close: HTMLElement;
  minimize: HTMLElement;
  zoom: HTMLElement;
}): () => void {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const appWindow = getCurrentWindow();
  const windows = isWindowsChrome();
  const onClose = (): void => {
    void appWindow.close();
  };
  const onMinimize = (): void => {
    void appWindow.minimize();
  };
  const onZoom = (event: MouseEvent): void => {
    if (zoomAction(event.altKey, windows) === "maximize") {
      void appWindow.toggleMaximize();
      return;
    }
    void toggleNativeFullscreen();
  };

  buttons.close.addEventListener("click", onClose);
  buttons.minimize.addEventListener("click", onMinimize);
  buttons.zoom.addEventListener("click", onZoom);

  return () => {
    buttons.close.removeEventListener("click", onClose);
    buttons.minimize.removeEventListener("click", onMinimize);
    buttons.zoom.removeEventListener("click", onZoom);
  };
}

/**
 * Mirrors maximize state onto the zoom/caption button (Windows restore glyph).
 */
export function bindMaximizeClass(zoom: HTMLElement): () => void {
  if (!isTauriRuntime() || !isWindowsChrome()) {
    return () => {};
  }

  const appWindow = getCurrentWindow();
  const sync = async (): Promise<void> => {
    zoom.classList.toggle(MAXIMIZED_CLASS, await appWindow.isMaximized());
  };
  void sync();
  let stop: (() => void) | undefined;
  void appWindow
    .onResized(() => {
      void sync();
    })
    .then((unlisten) => {
      stop = unlisten;
    });
  return () => {
    stop?.();
  };
}

/**
 * Toggles native fullscreen.
 */
export async function toggleNativeFullscreen(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  const appWindow = getCurrentWindow();
  await appWindow.setFullscreen(!(await appWindow.isFullscreen()));
}

/**
 * Double-click on the top strip maximizes, matching a title-bar zoom.
 */
export function bindTitleDoubleClick(strip: HTMLElement): () => void {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const appWindow = getCurrentWindow();
  const onDblClick = (event: MouseEvent): void => {
    event.preventDefault();
    void appWindow.toggleMaximize();
  };
  strip.addEventListener("dblclick", onDblClick);
  return () => {
    strip.removeEventListener("dblclick", onDblClick);
  };
}

/**
 * Drops the window radius while the app occupies a fullscreen Space.
 */
export function bindFullscreenClass(paper: HTMLElement): () => void {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const appWindow = getCurrentWindow();
  const sync = async (): Promise<void> => {
    paper.classList.toggle(FULLSCREEN_CLASS, await appWindow.isFullscreen());
  };
  void sync();
  let stop: (() => void) | undefined;
  void appWindow
    .onResized(() => {
      void sync();
    })
    .then((unlisten) => {
      stop = unlisten;
    });
  return () => {
    stop?.();
  };
}
