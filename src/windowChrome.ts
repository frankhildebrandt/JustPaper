import { getCurrentWindow } from "@tauri-apps/api/window";

export const WINDOW_CONTROLS_EDGE_PX = 40;
const VISIBLE_CLASS = "is-visible";
const FULLSCREEN_CLASS = "is-fullscreen";

export type ZoomAction = "fullscreen" | "maximize";

/**
 * Returns whether the traffic lights should show for a pointer at `mouseY`.
 */
export function windowControlsVisible(
  mouseY: number,
  threshold: number = WINDOW_CONTROLS_EDGE_PX,
): boolean {
  return mouseY <= threshold;
}

/**
 * Maps a green-button click: Option zooms, otherwise native fullscreen.
 */
export function zoomAction(altKey: boolean): ZoomAction {
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
 * Wires macOS-style traffic lights to the current Tauri window.
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
  const onClose = (): void => {
    void appWindow.close();
  };
  const onMinimize = (): void => {
    void appWindow.minimize();
  };
  const onZoom = (event: MouseEvent): void => {
    if (zoomAction(event.altKey) === "maximize") {
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
 * Toggles macOS fullscreen (own Space).
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
  void appWindow.onResized(() => {
    void sync();
  }).then((unlisten) => {
    stop = unlisten;
  });
  return () => {
    stop?.();
  };
}
