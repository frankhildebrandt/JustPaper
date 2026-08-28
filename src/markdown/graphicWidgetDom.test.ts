import { describe, expect, it } from "vitest";
import {
  graphicWidgetFromDomPos,
  isGraphicWidgetElement,
} from "./graphicWidgetDom";

type FakeEl = {
  nodeType: 1;
  classList: { contains(name: string): boolean };
  parentElement: FakeEl | null;
  childNodes: FakeEl[];
};

/**
 * Minimal element tree so widget lookup can be tested without a DOM lib.
 */
function el(className: string, children: FakeEl[] = []): FakeEl {
  const names = new Set(className.split(/\s+/).filter(Boolean));
  const node: FakeEl = {
    nodeType: 1,
    classList: { contains: (name) => names.has(name) },
    parentElement: null,
    childNodes: children,
  };
  for (const child of children) {
    child.parentElement = node;
  }
  return node;
}

describe("isGraphicWidgetElement", () => {
  it("recognizes table, code, and hr widget roots", () => {
    expect(isGraphicWidgetElement(el("md-table-wrap"))).toBe(true);
    expect(isGraphicWidgetElement(el("md-code-card is-editable"))).toBe(true);
    expect(isGraphicWidgetElement(el("md-hr-wrap"))).toBe(true);
    expect(isGraphicWidgetElement(el("cm-line"))).toBe(false);
  });
});

describe("graphicWidgetFromDomPos", () => {
  it("picks the content child at the given offset, not an earlier sibling widget", () => {
    const earlier = el("md-table-wrap is-editable");
    const target = el("md-table-wrap is-editable");
    const content = el("cm-content cm-lineWrapping", [
      earlier,
      el("cm-line"),
      target,
    ]);
    // Offset 2 → target; a content-wide querySelector would have returned earlier.
    expect(graphicWidgetFromDomPos(content as unknown as Node, 2)).toBe(target);
    expect(graphicWidgetFromDomPos(content as unknown as Node, 0)).toBe(
      earlier,
    );
  });

  it("finds a widget nested one level under the content child", () => {
    const card = el("md-code-card");
    const wrap = el("cm-line", [card]);
    const content = el("cm-content", [wrap]);
    expect(graphicWidgetFromDomPos(content as unknown as Node, 0)).toBe(card);
  });

  it("walks up from an inner node to the widget root", () => {
    const cell = el("td");
    const row = el("tr", [cell]);
    const body = el("tbody", [row]);
    const graphic = el("md-table-graphic", [body]);
    const wrap = el("md-table-wrap", [graphic]);
    el("cm-content", [wrap, el("md-table-wrap")]);
    expect(graphicWidgetFromDomPos(cell as unknown as Node, 0)).toBe(wrap);
  });

  it("returns null for a plain cm-line under content", () => {
    const line = el("cm-line");
    const content = el("cm-content", [line]);
    expect(graphicWidgetFromDomPos(content as unknown as Node, 0)).toBeNull();
  });
});
