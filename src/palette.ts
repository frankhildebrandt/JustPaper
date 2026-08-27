export type PaletteItem = {
  id: string;
  title: string;
  detail?: string;
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
      li.textContent = item.title;
      if (item.detail) {
        const detail = document.createElement("span");
        detail.className = "palette-item-detail";
        detail.textContent = `  ${item.detail}`;
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
    const id = ++request;
    const next = await session.load(queryInput.value);
    if (id !== request || !session) {
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
