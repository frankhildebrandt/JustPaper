import { displayName } from "./filename";
import {
  filenameFlowHiddenByPeek,
  filenameFlowTopPx,
  filenameFlowVisible,
} from "./filenameLayout";

export type FilenameBar = {
  setPath: (path: string | null) => void;
  setScroller: (element: HTMLElement) => void;
  sync: () => void;
  disconnect: () => void;
};

/**
 * Binds the in-flow filename and the top-edge peek so either can rename.
 */
export function bindFilenameBar(
  flow: HTMLInputElement,
  onCommit: (name: string) => Promise<boolean> | boolean,
  peek?: HTMLInputElement,
): FilenameBar {
  let path: string | null = null;
  let editing: HTMLInputElement | undefined;
  let scroller: HTMLElement | undefined;
  let stopScroll: (() => void) | undefined;
  const inputs = peek ? [flow, peek] : [flow];
  const observer = new ResizeObserver(() => {
    layout();
  });
  observer.observe(flow);

  const show = (): void => {
    const name = displayName(path);
    for (const input of inputs) {
      if (input !== editing) {
        input.value = name;
      }
    }
  };

  const commit = async (input: HTMLInputElement): Promise<void> => {
    if (editing !== input) {
      return;
    }
    editing = undefined;
    const next = input.value.trim();
    const ok = await onCommit(next);
    if (!ok) {
      show();
    }
    layout();
  };

  const bindInput = (input: HTMLInputElement): void => {
    const onFocus = (): void => {
      editing = input;
      input.select();
      layout();
    };
    const onBlur = (): void => {
      void commit(input);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        editing = undefined;
        show();
        input.blur();
        layout();
      }
    };
    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    input.addEventListener("keydown", onKeyDown);
  };

  const layout = (): void => {
    if (!scroller) {
      flow.style.opacity = "0";
      flow.style.pointerEvents = "none";
      return;
    }
    const style = getComputedStyle(scroller);
    const lineHeightPx = parseFloat(style.lineHeight) || flow.offsetHeight;
    const top = filenameFlowTopPx({
      paddingTopPx: parseFloat(style.paddingTop) || 0,
      scrollTopPx: scroller.scrollTop,
      filenameHeightPx: flow.offsetHeight,
      gapPx: lineHeightPx * 0.45,
    });
    flow.style.top = `${top}px`;
    const peekVisible = peek?.classList.contains("is-visible") ?? false;
    const peekHeight = peek?.offsetHeight ?? 40;
    const visible =
      filenameFlowVisible(top, flow.offsetHeight, scroller.clientHeight) &&
      !filenameFlowHiddenByPeek(top, peekVisible, peekHeight);
    const showFlow = visible || editing === flow;
    flow.style.opacity = showFlow ? "1" : "0";
    flow.style.pointerEvents = showFlow ? "auto" : "none";
  };

  for (const input of inputs) {
    bindInput(input);
  }
  show();
  layout();

  return {
    setPath: (next: string | null): void => {
      path = next;
      show();
    },
    setScroller: (element: HTMLElement): void => {
      stopScroll?.();
      scroller = element;
      observer.observe(element);
      const onScroll = (): void => {
        layout();
      };
      element.addEventListener("scroll", onScroll);
      stopScroll = (): void => {
        element.removeEventListener("scroll", onScroll);
        observer.unobserve(element);
      };
      layout();
    },
    sync: layout,
    disconnect: (): void => {
      stopScroll?.();
      observer.disconnect();
    },
  };
}
