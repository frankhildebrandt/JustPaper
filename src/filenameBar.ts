import { displayName } from "./filename";
import {
  filenameFlowHiddenByPeek,
  filenameFlowTopPx,
  filenameFlowVisible,
} from "./filenameLayout";
import { renderTagBadges } from "./tagBadge";

export type FilenameBarTargets = {
  row: HTMLElement;
  input: HTMLInputElement;
  tags: HTMLElement;
};

export type FilenameBar = {
  setPath: (path: string | null) => void;
  setTags: (tags: readonly string[]) => void;
  setScroller: (element: HTMLElement) => void;
  sync: () => void;
  disconnect: () => void;
};

/**
 * Binds the in-flow filename and the top-edge peek so either can rename.
 */
export function bindFilenameBar(
  flow: FilenameBarTargets,
  onCommit: (name: string) => Promise<boolean> | boolean,
  peek?: FilenameBarTargets,
  onHeightChange?: (heightPx: number) => void,
): FilenameBar {
  let path: string | null = null;
  let editing: HTMLInputElement | undefined;
  let scroller: HTMLElement | undefined;
  let stopScroll: (() => void) | undefined;
  const inputs = peek ? [flow.input, peek.input] : [flow.input];
  const observer = new ResizeObserver(() => {
    layout();
  });
  observer.observe(flow.row);

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
    onHeightChange?.(flow.row.offsetHeight);
    if (!scroller) {
      flow.row.style.opacity = "0";
      flow.row.style.pointerEvents = "none";
      return;
    }
    const style = getComputedStyle(scroller);
    const lineHeightPx = parseFloat(style.lineHeight) || flow.row.offsetHeight;
    const top = filenameFlowTopPx({
      paddingTopPx: parseFloat(style.paddingTop) || 0,
      scrollTopPx: scroller.scrollTop,
      filenameHeightPx: flow.row.offsetHeight,
      gapPx: lineHeightPx * 0.45,
    });
    flow.row.style.top = `${top}px`;
    const peekVisible = peek?.row.classList.contains("is-visible") ?? false;
    const peekHeight = peek?.row.offsetHeight ?? 40;
    const visible =
      filenameFlowVisible(top, flow.row.offsetHeight, scroller.clientHeight) &&
      !filenameFlowHiddenByPeek(top, peekVisible, peekHeight);
    const showFlow = visible || editing === flow.input;
    flow.row.style.opacity = showFlow ? "1" : "0";
    flow.row.style.pointerEvents = showFlow ? "auto" : "none";
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
    setTags: (tags: readonly string[]): void => {
      renderTagBadges(flow.tags, tags);
      if (peek) {
        renderTagBadges(peek.tags, tags);
      }
      layout();
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
