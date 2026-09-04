import { linesPerPage } from "./caret";
import { renderTagBadges } from "./tagBadge";

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
 * Binds a paper overlay that filters items from a query and picks with Enter.
 */
export function bindPalette(
  root: HTMLElement,
  queryInput: HTMLInputElement,
  results: HTMLElement,
): PaletteBinding {
  let active = 0;
  let items: PaletteItem[] = [];
  let session: PaletteOpenOptions | undefined;
  let request = 0;

  const close = (): void => {
    session = undefined;
    items = [];
    root.hidden = true;
    queryInput.value = "";
    results.replaceChildren();
  };

  const render = (): void => {
    results.replaceChildren();
    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "palette-item";
      li.classList.toggle("is-active", index === active);
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
        pick(item);
      });
      results.append(li);
    });
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

  const refresh = async (): Promise<void> => {
    if (!session) {
      return;
    }
    const current = session;
    const id = ++request;
    let next: PaletteItem[];
    try {
      next = await current.load(queryInput.value);
    } catch {
      if (id === request && session === current) {
        items = [];
        active = 0;
        render();
      }
      return;
    }
    if (id !== request || session !== current) {
      return;
    }
    items = next;
    active = items.length === 0 ? 0 : Math.min(active, items.length - 1);
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
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (items.length === 0) {
        return;
      }
      active = (active + 1) % items.length;
      render();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) {
        return;
      }
      active = (active - 1 + items.length) % items.length;
      render();
      return;
    }
    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      if (items.length === 0) {
        return;
      }
      const direction = event.key === "PageDown" ? 1 : -1;
      active = indexAfterPage(
        active,
        items.length,
        direction,
        resultsPageSize(results),
      );
      render();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active];
      if (item) {
        pick(item);
      }
    }
  };

  queryInput.addEventListener("input", () => {
    void refresh();
  });
  queryInput.addEventListener("keydown", onKeyDown);
  root.addEventListener("wheel", onWheel, { passive: true });

  return {
    open: (options: PaletteOpenOptions): void => {
      session = options;
      active = 0;
      queryInput.placeholder = options.placeholder;
      queryInput.value = "";
      root.hidden = false;
      queryInput.focus();
      void refresh();
    },
    close,
    disconnect: (): void => {
      queryInput.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("wheel", onWheel);
      close();
    },
  };
}
