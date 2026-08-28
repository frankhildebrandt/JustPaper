const WIDGET_CLASSES = [
  "md-table-wrap",
  "md-code-card",
  "md-hr-wrap",
] as const;

/**
 * Whether `el` is a block graphic widget root.
 */
export function isGraphicWidgetElement(el: {
  classList: { contains(name: string): boolean };
}): boolean {
  return WIDGET_CLASSES.some((name) => el.classList.contains(name));
}

/**
 * Resolves the graphic widget under a CodeMirror `domAtPos` result.
 * When CM reports `.cm-content` + child index (block widgets), uses that child
 * only — never `querySelector` on content, which would hit an earlier widget.
 */
export function graphicWidgetFromDomPos(
  node: Node,
  offset: number,
): HTMLElement | null {
  const element = asElement(node);
  if (element?.classList.contains("cm-content")) {
    const child =
      asElement(element.childNodes[offset]) ??
      (offset > 0 ? asElement(element.childNodes[offset - 1]) : null);
    if (!child) {
      return null;
    }
    if (isGraphicWidgetElement(child)) {
      return child;
    }
    for (const nested of child.childNodes) {
      const nestedEl = asElement(nested);
      if (nestedEl && isGraphicWidgetElement(nestedEl)) {
        return nestedEl;
      }
    }
    return null;
  }

  let el =
    node.nodeType === 3
      ? asElement((node as Text).parentElement)
      : element;
  while (el) {
    if (isGraphicWidgetElement(el)) {
      return el;
    }
    if (el.classList.contains("cm-content")) {
      return null;
    }
    el = asElement(el.parentElement);
  }
  return null;
}

function asElement(node: Node | null | undefined): HTMLElement | null {
  if (!node || node.nodeType !== 1) {
    return null;
  }
  return node as HTMLElement;
}
