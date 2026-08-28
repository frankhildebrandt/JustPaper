export type InlineLinkSpan = {
  kind: "link" | "image";
  from: number;
  to: number;
  markOpen: { from: number; to: number };
  markClose: { from: number; to: number };
  label: { from: number; to: number };
  href: string;
  dest: { from: number; to: number };
  alt: string;
};

/**
 * Parses `[text](url)` or `![alt](src)` starting at `from`.
 * Links only accept http(s) destinations; images reject javascript URLs.
 */
export function parseInlineLink(
  source: string,
  from: number,
): InlineLinkSpan | undefined {
  const image = source.startsWith("![", from);
  if (!image && !source.startsWith("[", from)) {
    return undefined;
  }
  if (!image && source.startsWith("[[", from)) {
    return undefined;
  }
  const labelFrom = image ? from + 2 : from + 1;
  const labelClose = source.indexOf("](", labelFrom);
  if (labelClose === -1) {
    return undefined;
  }
  const destFrom = labelClose + 2;
  const destClose = source.indexOf(")", destFrom);
  if (destClose === -1) {
    return undefined;
  }
  const href = source.slice(destFrom, destClose).trim();
  if (href.length === 0 || href.toLowerCase().startsWith("javascript:")) {
    return undefined;
  }
  const kind = image ? "image" : "link";
  if (kind === "link" && !isHttpUrl(href)) {
    return undefined;
  }
  return {
    kind,
    from,
    to: destClose + 1,
    markOpen: { from, to: labelFrom },
    markClose: { from: labelClose, to: destClose + 1 },
    label: { from: labelFrom, to: labelClose },
    href,
    dest: { from: destFrom, to: destClose },
    alt: source.slice(labelFrom, labelClose),
  };
}

function isHttpUrl(href: string): boolean {
  return href.startsWith("https://") || href.startsWith("http://");
}

/**
 * Returns the http(s) markdown link whose range contains `offset`.
 */
export function externalLinkAt(
  source: string,
  offset: number,
): InlineLinkSpan | undefined {
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf("[", cursor);
    if (open === -1) {
      break;
    }
    const start = open > 0 && source[open - 1] === "!" ? open - 1 : open;
    const link = parseInlineLink(source, start);
    if (
      link &&
      link.kind === "link" &&
      offset >= link.from &&
      offset <= link.to
    ) {
      return link;
    }
    cursor = open + 1;
  }
  return undefined;
}
