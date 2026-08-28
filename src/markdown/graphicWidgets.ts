import { EditorView, WidgetType } from "@codemirror/view";
import { codeCard } from "./codeCard";
import { graphicSelection } from "./graphicNav";
import type { CellNode } from "./tableCells";
import {
  sourcePosFromCodeClick,
  sourcePosFromTablePoint,
} from "./visualPos";

/**
 * Renders a GFM table as a real HTML table. In Edit a click opens the source.
 */
export class TableWidget extends WidgetType {
  constructor(
    readonly header: CellNode[][],
    readonly rows: CellNode[][][],
    readonly cellPositions: Array<Array<{ from: number; to: number }>> = [],
    readonly opensSource = false,
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return (
      this.opensSource === other.opensSource &&
      JSON.stringify(this.header) === JSON.stringify(other.header) &&
      JSON.stringify(this.rows) === JSON.stringify(other.rows) &&
      JSON.stringify(this.cellPositions) === JSON.stringify(other.cellPositions)
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = this.opensSource
      ? "md-table-wrap is-editable"
      : "md-table-wrap";
    const table = document.createElement("table");
    table.className = "md-table-graphic";
    const thead = document.createElement("thead");
    thead.append(rowEl("th", this.header, this.cellPositions[0]));
    table.append(thead);
    const tbody = document.createElement("tbody");
    this.rows.forEach((row, index) => {
      tbody.append(rowEl("td", row, this.cellPositions[index + 1]));
    });
    table.append(tbody);
    wrap.append(table);
    if (this.opensSource) {
      bindOpenSource(wrap, view, (event) => {
        return (
          sourcePosFromTablePoint(
            (from, to) => view.state.doc.sliceString(from, to),
            wrap,
            event.clientX,
            event.clientY,
          ) ?? view.posAtDOM(wrap)
        );
      });
    }
    return wrap;
  }

  ignoreEvent(event: Event): boolean {
    return shouldIgnoreGraphicEvent(event, this.opensSource);
  }
}

/**
 * Renders a fenced code block as a numbered card. In Edit a click opens source.
 */
export class CodeWidget extends WidgetType {
  constructor(
    readonly language: string,
    readonly body: string,
    readonly opensSource = false,
    readonly bodyFrom = 0,
  ) {
    super();
  }

  eq(other: CodeWidget): boolean {
    return (
      this.opensSource === other.opensSource &&
      this.bodyFrom === other.bodyFrom &&
      this.language === other.language &&
      this.body === other.body
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const card = codeCard(this.language, this.body);
    const wrap = document.createElement("div");
    wrap.className = this.opensSource
      ? "md-code-card is-editable"
      : "md-code-card";
    if (card.language.length > 0) {
      const label = document.createElement("span");
      label.className = "md-code-lang";
      label.textContent = card.language;
      wrap.append(label);
    }
    const body = document.createElement("div");
    body.className = "md-code-card-body";
    for (const line of card.lines) {
      const row = document.createElement("div");
      row.className = "md-code-line";
      const number = document.createElement("span");
      number.className = "md-code-n";
      number.textContent = String(line.number);
      const src = document.createElement("span");
      src.className = "md-code-src";
      for (const span of line.spans) {
        if (span.kind === "text") {
          src.append(span.text);
          continue;
        }
        const token = document.createElement("span");
        token.className = `md-syn-${span.kind}`;
        token.textContent = span.text;
        src.append(token);
      }
      row.append(number, src);
      body.append(row);
    }
    wrap.append(body);
    if (this.opensSource) {
      bindOpenSource(wrap, view, (event) =>
        sourcePosFromCodeClick(
          this.bodyFrom,
          this.body,
          wrap,
          event.clientX,
          event.clientY,
        ),
      );
    }
    return wrap;
  }

  ignoreEvent(event: Event): boolean {
    return shouldIgnoreGraphicEvent(event, this.opensSource);
  }
}

/**
 * Renders a thematic break. In Edit a click opens the `---` source line.
 */
export class HrWidget extends WidgetType {
  constructor(readonly opensSource = false) {
    super();
  }

  eq(other: HrWidget): boolean {
    return this.opensSource === other.opensSource;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = this.opensSource ? "md-hr-wrap is-editable" : "md-hr-wrap";
    const rule = document.createElement("hr");
    rule.className = "md-hr";
    wrap.append(rule);
    if (this.opensSource) {
      bindOpenSource(wrap, view, () => view.posAtDOM(wrap));
    }
    return wrap;
  }

  ignoreEvent(event: Event): boolean {
    return shouldIgnoreGraphicEvent(event, this.opensSource);
  }
}

/**
 * Renders a blockquote or Obsidian callout without `>` marks.
 */
export class QuoteWidget extends WidgetType {
  constructor(
    readonly lines: string[],
    readonly calloutType?: string,
    readonly calloutTitle?: string,
    readonly bodyNodes: CellNode[][] = [],
  ) {
    super();
  }

  eq(other: QuoteWidget): boolean {
    return (
      this.calloutType === other.calloutType &&
      this.calloutTitle === other.calloutTitle &&
      sameCells(this.lines, other.lines) &&
      JSON.stringify(this.bodyNodes) === JSON.stringify(other.bodyNodes)
    );
  }

  toDOM(): HTMLElement {
    if (this.calloutType) {
      return calloutDom(
        this.calloutType,
        this.calloutTitle ?? this.calloutType,
        this.bodyNodes,
        this.lines,
      );
    }
    const quote = document.createElement("blockquote");
    quote.className = "md-quote-graphic";
    for (const line of this.lines) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      quote.append(paragraph);
    }
    return quote;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function calloutDom(
  type: string,
  title: string,
  bodyNodes: CellNode[][],
  fallbackLines: string[],
): HTMLElement {
  const wrap = document.createElement("aside");
  wrap.className = `md-callout md-callout-${type}`;
  wrap.dataset.callout = type;
  const titleEl = document.createElement("div");
  titleEl.className = "md-callout-title";
  titleEl.textContent = title;
  wrap.append(titleEl);
  const body = document.createElement("div");
  body.className = "md-callout-body";
  if (bodyNodes.length > 0) {
    for (const line of bodyNodes) {
      const paragraph = document.createElement("p");
      appendNodes(paragraph, line);
      body.append(paragraph);
    }
  } else {
    for (const line of fallbackLines) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      body.append(paragraph);
    }
  }
  wrap.append(body);
  return wrap;
}

function bindOpenSource(
  wrap: HTMLElement,
  view: EditorView,
  resolvePos: (event: MouseEvent) => number,
): void {
  wrap.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const head = resolvePos(event);
    view.dispatch({
      selection: graphicSelection(
        head,
        event.shiftKey,
        view.state.selection.main.anchor,
      ),
    });
    view.focus();
  });
}

/**
 * Own the whole click gesture so CM cannot reposition after we open source.
 */
function shouldIgnoreGraphicEvent(
  event: Event,
  opensSource: boolean,
): boolean {
  if (!opensSource) {
    return false;
  }
  if ((event as MouseEvent).button !== 0 && event.type !== "click") {
    return false;
  }
  return (
    event.type === "mousedown" ||
    event.type === "mouseup" ||
    event.type === "click"
  );
}

function rowEl(
  cellTag: "th" | "td",
  cells: CellNode[][],
  positions?: Array<{ from: number; to: number }>,
): HTMLTableRowElement {
  const row = document.createElement("tr");
  cells.forEach((cell, index) => {
    const el = document.createElement(cellTag);
    const range = positions?.[index];
    if (range) {
      el.dataset.pos = String(range.from);
      el.dataset.to = String(range.to);
    }
    appendNodes(el, cell);
    row.append(el);
  });
  return row;
}

function appendNodes(parent: HTMLElement, nodes: CellNode[]): void {
  for (const node of nodes) {
    parent.append(nodeToDom(node));
  }
}

function nodeToDom(node: CellNode): Node {
  if (node.kind === "text") {
    return document.createTextNode(node.text);
  }
  if (node.kind === "wiki" || node.kind === "link") {
    const el = document.createElement(node.kind === "link" ? "a" : "span");
    el.className = "md-wiki";
    el.textContent = node.text;
    if (node.kind === "link" && node.href) {
      el.setAttribute("href", node.href);
    }
    return el;
  }
  if (node.kind === "strong" || node.kind === "em" || node.kind === "code") {
    const tag =
      node.kind === "strong" ? "strong" : node.kind === "em" ? "em" : "code";
    const el = document.createElement(tag);
    el.className = `md-${node.kind}`;
    appendNodes(el, node.children);
    return el;
  }
  return document.createTextNode("");
}

function sameCells(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((cell, index) => cell === right[index])
  );
}
