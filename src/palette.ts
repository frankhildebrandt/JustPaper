import { bindDebounce } from "./debounce";
import { linesPerPage } from "./caret";
import { renderTagBadges } from "./tagBadge";

export const PALETTE_QUERY_DELAY_MS = 150;
const LOAD_ERROR_TEXT = "Ergebnisse konnten nicht geladen werden.";

export type PaletteItem = {
  id: string;
  title: string;
  detail?: string;
  tags?: readonly string[];
};

export type PaletteBinding = {
  open: (options: PaletteOpenOptions) => void;
  close: () => void;
  disconnect: () => void;
};

export type PaletteOpenOptions = {
  placeholder: string;
  load: (query: string) => Promise<PaletteItem[]> | PaletteItem[];
  onPick: (item: PaletteItem) => void;
  /** Shown in the results area when `load` returns no items. */
  emptyText?: string;
};

export type PaletteStatus = {
  itemCount: number;
  failed: boolean;
  emptyText?: string;
};

/**
 * Returns the active index after moving a page, clamped to the list.
 */
export function indexAfterPage(
  active: number,
  itemCount: number,
  direction: 1 | -1,
  pageSize: number,
): number {
  if (itemCount <= 0) {
    return 0;
  }
  const step = Math.max(1, pageSize);
  return Math.min(itemCount - 1, Math.max(0, active + direction * step));
}

/**
 * Returns the active index after new results arrive: the first item for a
 * changed query, otherwise the previous index clamped to the list.
 */
export function activeAfterLoad(
  active: number,
  itemCount: number,
  queryChanged: boolean,
): number {
  if (itemCount === 0 || queryChanged) {
    return 0;
  }
  return Math.min(active, itemCount - 1);
}

/**
 * Returns the German status line for the results area, or undefined when
 * the item list speaks for itself.
 */
export function paletteStatusText(status: PaletteStatus): string | undefined {
  if (status.failed) {
    return LOAD_ERROR_TEXT;
  }
  if (status.itemCount === 0) {
    return status.emptyText;
  }
  return undefined;
}

/**
 * Returns how many palette items Page Up/Down should skip, overlapping one.
 */
function resultsPageSize(results: HTMLElement): number {
  const first = results.children[0];
  const itemHeight = first instanceof HTMLElement ? first.offsetHeight : 0;
  if (itemHeight <= 0) {
    return 1;
  }
  return linesPerPage(results.clientHeight, itemHeight);
}

/**
 * Builds one result row; `onPick` runs on mouse down so focus stays put.
 */
function itemRow(
  item: PaletteItem,
  active: boolean,
  onPick: (item: PaletteItem) => void,
): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "palette-item";
  li.classList.toggle("is-active", active);
  const title = document.createElement("span");
  title.className = "palette-item-title";
  title.textContent = item.title;
  li.append(title);
  if (item.tags && item.tags.length > 0) {
    const badges = document.createElement("span");
    badges.className = "tag-badges";
    renderTagBadges(badges, item.tags);
    li.append(badges);
  }
  if (item.detail) {
    const detail = document.createElement("span");
    detail.className = "palette-item-detail";
    detail.textContent = item.detail;
    li.append(detail);
  }
  li.addEventListener("mousedown", (event) => {
    event.preventDefault();
    onPick(item);
  });
  return li;
}

/**
 * Builds the non-selectable status row for errors and empty results.
 */
function statusRow(text: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "palette-status";
  li.setAttribute("role", "status");
  li.textContent = text;
  return li;
}

/**
 * Binds a paper overlay that filters items from a query and picks with Enter.
 * Typing refreshes after a short pause, Escape or leaving the palette closes
 * it, and Escape returns focus to where it was before opening.
 */
export function bindPalette(
  root: HTMLElement,
  queryInput: HTMLInputElement,
  results: HTMLElement,
): PaletteBinding {
  let active = 0;
  let items: PaletteItem[] = [];
  let failed = false;
  let loadedQuery = "";
  let session: PaletteOpenOptions | undefined;
  let request = 0;
  let returnFocus: HTMLElement | undefined;

  const typing = bindDebounce(() => refresh(), PALETTE_QUERY_DELAY_MS);

  const close = (restoreFocus = true): void => {
    const wasOpen = !root.hidden;
    typing.cancel();
    session = undefined;
    items = [];
    failed = false;
    root.hidden = true;
    queryInput.value = "";
    results.replaceChildren();
    const target = returnFocus;
    returnFocus = undefined;
    if (wasOpen && restoreFocus && target?.isConnected) {
      target.focus({ preventScroll: true });
    }
  };

  const render = (): void => {
    const status = paletteStatusText({
      itemCount: items.length,
      failed,
      emptyText: session?.emptyText,
    });
    const rows = items.map((item, index) => itemRow(item, index === active, pick));
    results.replaceChildren(...(status === undefined ? rows : [statusRow(status)]));
    const selected = results.children[active];
    if (selected instanceof HTMLElement) {
      selected.scrollIntoView({ block: "nearest" });
    }
  };

  const pick = (item: PaletteItem): void => {
    const current = session;
    close();
    current?.onPick(item);
  };

  const showResults = (next: PaletteItem[], query: string, loadFailed: boolean): void => {
    items = next;
    failed = loadFailed;
    active = activeAfterLoad(active, items.length, query !== loadedQuery);
    loadedQuery = query;
    render();
  };

  const refresh = async (): Promise<void> => {
    if (!session) {
      return;
    }
    const current = session;
    const id = ++request;
    const query = queryInput.value;
    const isCurrent = (): boolean => id === request && session === current;
    try {
      const next = await current.load(query);
      if (isCurrent()) {
        showResults(next, query, false);
      }
    } catch {
      if (isCurrent()) {
        showResults([], query, true);
      }
    }
  };

  const pickActive = async (): Promise<void> => {
    await typing.flush();
    const item = items[active];
    if (item) {
      pick(item);
    }
  };

  const moveActive = (next: number): void => {
    if (items.length === 0) {
      return;
    }
    active = next;
    render();
  };

  const onWheel = (event: WheelEvent): void => {
    event.stopPropagation();
    if (results.contains(event.target as Node)) {
      return;
    }
    results.scrollTop += event.deltaY;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (root.hidden) {
      return;
    }
    const count = items.length;
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "ArrowDown":
        event.preventDefault();
        moveActive((active + 1) % Math.max(count, 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        moveActive((active - 1 + count) % Math.max(count, 1));
        return;
      case "PageDown":
      case "PageUp":
        event.preventDefault();
        moveActive(
          indexAfterPage(
            active,
            count,
            event.key === "PageDown" ? 1 : -1,
            resultsPageSize(results),
          ),
        );
        return;
      case "Enter":
        event.preventDefault();
        void pickActive();
    }
  };

  const onInput = (): void => {
    typing.schedule();
  };

  const onRootMouseDown = (event: MouseEvent): void => {
    if (event.target !== queryInput) {
      event.preventDefault();
    }
  };

  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && root.contains(next)) {
      return;
    }
    if (next instanceof HTMLElement) {
      close(false);
    }
  };

  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (root.hidden || root.contains(event.target as Node)) {
      return;
    }
    close();
  };

  queryInput.addEventListener("input", onInput);
  queryInput.addEventListener("keydown", onKeyDown);
  root.addEventListener("wheel", onWheel, { passive: true });
  root.addEventListener("mousedown", onRootMouseDown);
  root.addEventListener("focusout", onFocusOut);
  document.addEventListener("pointerdown", onDocumentPointerDown, true);

  return {
    open: (options: PaletteOpenOptions): void => {
      if (root.hidden) {
        returnFocus = focusedElement();
      }
      typing.cancel();
      session = options;
      active = 0;
      failed = false;
      loadedQuery = "";
      queryInput.placeholder = options.placeholder;
      queryInput.value = "";
      root.hidden = false;
      queryInput.focus();
      void refresh();
    },
    close: (): void => close(),
    disconnect: (): void => {
      queryInput.removeEventListener("input", onInput);
      queryInput.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("mousedown", onRootMouseDown);
      root.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      close(false);
    },
  };
}

function focusedElement(): HTMLElement | undefined {
  const element = document.activeElement;
  return element instanceof HTMLElement && element !== document.body
    ? element
    : undefined;
}
