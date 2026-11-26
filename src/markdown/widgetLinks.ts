import { openExternalUrl } from "./openExternalUrl";

/** Selector for rendered links inside graphic widgets. */
export const LINK_SELECTOR = "[data-href]";

type FollowClick = Pick<MouseEvent, "button" | "metaKey" | "ctrlKey"> & {
  target: EventTarget | null;
};

type ClosestTarget = {
  closest: (selector: string) => { getAttribute(name: string): string | null } | null;
};

/**
 * Renders a link label as a non-navigating element; the href lives in
 * `data-href` so a click can never send the app webview to the site.
 */
export function linkElement(text: string, href: string | undefined): HTMLElement {
  const el = document.createElement("span");
  el.className = "md-link";
  el.textContent = text;
  if (href) {
    el.dataset.href = href;
  }
  return el;
}

/**
 * Href of the widget link hit by a follow gesture (primary Cmd/Ctrl-click,
 * the same gesture that follows inline links), otherwise undefined.
 */
export function followHrefAt(event: FollowClick): string | undefined {
  if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) {
    return undefined;
  }
  const target = event.target as Partial<ClosestTarget> | null;
  const link = target?.closest?.(LINK_SELECTOR);
  return link?.getAttribute("data-href") ?? undefined;
}

/**
 * Opens widget links under `root` in the system browser on the follow gesture.
 */
export function bindLinkFollow(root: HTMLElement): void {
  root.addEventListener("click", (event) => {
    const href = followHrefAt(event);
    if (href === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void openExternalUrl(href);
  });
}
