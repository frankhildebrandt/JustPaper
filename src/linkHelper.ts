export type LinkHelperItem = {
  id: string;
  title: string;
};

export type LinkHelperAnchor = {
  left: number;
  top: number;
};

export type LinkHelperBinding = {
  show: (options: {
    items: readonly LinkHelperItem[];
    active: number;
    anchor: LinkHelperAnchor;
  }) => void;
  hide: () => void;
  setActive: (index: number) => number;
  isOpen: () => boolean;
  activeItem: () => LinkHelperItem | undefined;
  disconnect: () => void;
};

/**
 * Splits a project-relative path into directory and filename.
 */
export function splitProjectPath(path: string): {
  dir: string;
  name: string;
} {
  const slash = path.lastIndexOf("/");
  if (slash === -1) {
    return { dir: "", name: path };
  }
  return { dir: path.slice(0, slash), name: path.slice(slash + 1) };
}

/**
 * Binds a caret-anchored dropdown that lists fuzzy wiki-link candidates.
 */
export function bindLinkHelper(
  root: HTMLElement,
  results: HTMLElement,
  onPick: (item: LinkHelperItem) => void,
): LinkHelperBinding {
  let items: LinkHelperItem[] = [];
  let active = 0;
  let open = false;

  const hide = (): void => {
    open = false;
    items = [];
    active = 0;
    root.hidden = true;
    results.replaceChildren();
  };

  const scrollActiveIntoView = (): void => {
    const selected = results.children[active];
    if (!(selected instanceof HTMLElement)) {
      return;
    }
    const top = selected.offsetTop;
    const bottom = top + selected.offsetHeight;
    if (top < root.scrollTop) {
      root.scrollTop = top;
      return;
    }
    if (bottom > root.scrollTop + root.clientHeight) {
      root.scrollTop = bottom - root.clientHeight;
    }
  };

  const paintActive = (): void => {
    Array.from(results.children).forEach((child, index) => {
      child.classList.toggle("is-active", index === active);
    });
    scrollActiveIntoView();
  };

  const renderItem = (item: LinkHelperItem, index: number): HTMLLIElement => {
    const li = document.createElement("li");
    li.className = "link-helper-item";
    li.classList.toggle("is-active", index === active);
    const { dir, name } = splitProjectPath(item.title);
    const nameEl = document.createElement("span");
    nameEl.className = "link-helper-item-name";
    nameEl.textContent = name;
    li.append(nameEl);
    if (dir.length > 0) {
      const dirEl = document.createElement("span");
      dirEl.className = "link-helper-item-path";
      dirEl.textContent = dir;
      li.append(dirEl);
    }
    li.addEventListener("mousedown", (event) => {
      event.preventDefault();
      onPick(item);
    });
    return li;
  };

  const render = (): void => {
    results.replaceChildren();
    items.forEach((item, index) => {
      results.append(renderItem(item, index));
    });
    scrollActiveIntoView();
  };

  return {
    show: ({ items: next, active: nextActive, anchor }): void => {
      items = [...next];
      active =
        items.length === 0
          ? 0
          : Math.max(0, Math.min(nextActive, items.length - 1));
      open = items.length > 0;
      root.hidden = !open;
      if (!open) {
        results.replaceChildren();
        return;
      }
      root.style.left = `${Math.round(anchor.left)}px`;
      root.style.top = `${Math.round(anchor.top)}px`;
      render();
    },
    hide,
    setActive: (index: number): number => {
      if (!open || items.length === 0) {
        return 0;
      }
      active = ((index % items.length) + items.length) % items.length;
      paintActive();
      return active;
    },
    isOpen: (): boolean => open,
    activeItem: (): LinkHelperItem | undefined => items[active],
    disconnect: (): void => {
      hide();
    },
  };
}
