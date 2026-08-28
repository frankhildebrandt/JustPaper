import { displayOffsetFromPoint, sourcePosFromCellClick } from "./cellClick";

export type GlyphBox = {
  left: number;
  top: number;
  bottom: number;
  /** Inclusive start index into a parallel text-position list. */
  index: number;
};

export type CaretBox = {
  left: number;
  top: number;
  bottom: number;
};

/**
 * Picks the glyph index on the visual row under `clientY` that is closest to
 * `clientX`. Clicks past the last glyph on that row stay on the row end —
 * they must not fall through to a later paragraph.
 */
export function glyphIndexAtPoint(
  glyphs: GlyphBox[],
  clientX: number,
  clientY: number,
): number | undefined {
  if (glyphs.length === 0) {
    return undefined;
  }
  const row = glyphs.filter(
    (glyph) => clientY >= glyph.top - 1 && clientY <= glyph.bottom + 1,
  );
  const pool =
    row.length > 0 ? row : glyphsNearestRow(glyphs, clientX, clientY);
  if (pool.length === 0) {
    return undefined;
  }
  const last = pool[pool.length - 1];
  if (clientX > last.left + 1) {
    return last.index + 1;
  }
  let best = pool[0];
  let bestDist = Math.abs(best.left - clientX);
  for (const glyph of pool) {
    const dist = Math.abs(glyph.left - clientX);
    if (dist < bestDist) {
      best = glyph;
      bestDist = dist;
    }
  }
  return best.index;
}

function glyphsNearestRow(
  glyphs: GlyphBox[],
  clientX: number,
  clientY: number,
): GlyphBox[] {
  const rows = new Map<number, GlyphBox[]>();
  for (const glyph of glyphs) {
    const key = Math.round(glyph.top);
    const list = rows.get(key);
    if (list) {
      list.push(glyph);
    } else {
      rows.set(key, [glyph]);
    }
  }
  let best: GlyphBox[] = [];
  let bestScore = Infinity;
  for (const row of rows.values()) {
    const mid = (row[0].top + row[0].bottom) / 2;
    const yDist = Math.abs(mid - clientY);
    const left = row[0].left;
    const right = row[row.length - 1].left;
    const xOutside =
      clientX < left - 8
        ? left - 8 - clientX
        : clientX > right + 24
          ? clientX - (right + 24)
          : 0;
    // Prefer the row that actually contains the click horizontally so a slight
    // Y miss cannot jump to a shorter following wrap / next paragraph.
    const score = yDist + xOutside * 4;
    if (score < bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return best;
}

/**
 * Screen Y to probe for the next/previous visual text row (soft wrap).
 */
export function visualLineProbeY(
  caret: CaretBox,
  direction: 1 | -1,
): number {
  const height = Math.max(1, caret.bottom - caret.top);
  return direction === 1
    ? caret.bottom + height * 0.5
    : caret.top - height * 0.5;
}

/**
 * Whether a resolved arrow target is a real visual-line step (not a no-op).
 */
export function isVisualLineStep(
  from: number,
  to: number | undefined,
): to is number {
  return to !== undefined && to !== from;
}

/**
 * Whether a resolved caret is close enough to the click to trust.
 * Rejects end-of-doc / wrong-block hits from caretRangeFromPoint.
 */
export function clickPosMatchesPoint(
  clientX: number,
  clientY: number,
  caret: CaretBox | null | undefined,
  maxYDist = 28,
  maxXDist = 80,
): boolean {
  if (!caret || !Number.isFinite(caret.left)) {
    return false;
  }
  const yDist = Math.abs((caret.top + caret.bottom) / 2 - clientY);
  const xDist = Math.abs(caret.left - clientX);
  return yDist <= maxYDist && xDist <= maxXDist;
}

/**
 * Picks the document offset on `[from, to]` whose caret box best matches the
 * click. Scores vertical row first so soft-wrapped lines cannot collapse onto
 * the first visual row when DOM range boxes are wrong (common in WebKit).
 */
export function bestPosOnLineByCoords(
  from: number,
  to: number,
  clientX: number,
  clientY: number,
  coordsAtPos: (pos: number) => CaretBox | null | undefined,
): number | undefined {
  if (to < from) {
    return undefined;
  }
  type Hit = { pos: number; left: number; midY: number };
  const hits: Hit[] = [];
  let lineHeight = 16;
  for (let pos = from; pos <= to; pos += 1) {
    const coords = coordsAtPos(pos);
    if (!coords || !Number.isFinite(coords.left)) {
      continue;
    }
    const height = Math.max(1, coords.bottom - coords.top);
    lineHeight = Math.max(lineHeight, height);
    hits.push({
      pos,
      left: coords.left,
      midY: (coords.top + coords.bottom) / 2,
    });
  }
  if (hits.length === 0) {
    return undefined;
  }
  let bestMid = hits[0].midY;
  let bestYDist = Number.POSITIVE_INFINITY;
  for (const hit of hits) {
    const yDist = Math.abs(hit.midY - clientY);
    if (yDist < bestYDist) {
      bestYDist = yDist;
      bestMid = hit.midY;
    }
  }
  const rowSlack = Math.max(8, lineHeight * 0.55);
  const row = hits.filter((hit) => Math.abs(hit.midY - bestMid) <= rowSlack);
  const last = row[row.length - 1];
  if (clientX > last.left + 4) {
    return last.pos < to ? last.pos + 1 : last.pos;
  }
  let best = row[0];
  let bestDist = Math.abs(best.left - clientX);
  for (const hit of row) {
    const dist = Math.abs(hit.left - clientX);
    if (dist < bestDist) {
      best = hit;
      bestDist = dist;
    }
  }
  return best.pos;
}

/**
 * Maps a visual line/column inside a fenced code body to a document offset.
 * Code cards show body text 1:1 (highlight spans do not insert/remove chars).
 */
export function codeLineColumnToSource(
  bodyFrom: number,
  body: string,
  lineIndex: number,
  column: number,
): number {
  const lines = body.split("\n");
  let offset = bodyFrom;
  const last = Math.max(0, lines.length - 1);
  const target = Math.max(0, Math.min(lineIndex, last));
  for (let index = 0; index < target; index += 1) {
    offset += lines[index].length + 1;
  }
  const line = lines[target] ?? "";
  return offset + Math.max(0, Math.min(column, line.length));
}

export type ClientRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * Client point inside a graphic widget that preserves the caret's visual column
 * when arrow-entering from outside.
 */
export function enterClientPoint(
  caret: CaretBox | null,
  widget: ClientRect,
  direction: 1 | -1,
  axis: "along" | "across",
): { x: number; y: number } {
  const pad = 4;
  const minX = widget.left + 2;
  const maxX = Math.max(minX, widget.right - 2);
  const x = caret && Number.isFinite(caret.left)
    ? Math.min(Math.max(caret.left, minX), maxX)
    : minX;
  if (axis === "across") {
    return {
      x: direction === 1 ? widget.left + pad : widget.right - pad,
      y:
        caret && Number.isFinite(caret.top) && Number.isFinite(caret.bottom)
          ? Math.min(
              Math.max((caret.top + caret.bottom) / 2, widget.top + 2),
              widget.bottom - 2,
            )
          : widget.top + pad,
    };
  }
  return {
    x,
    y: direction === 1 ? widget.top + pad : widget.bottom - pad,
  };
}

/**
 * Collects left edges of visible glyphs under `root` for row-aware click mapping.
 * Uses getClientRects() so soft-wrapped characters keep their visual-row box
 * (WebKit's getBoundingClientRect often returns the union of every wrap).
 */
export function collectGlyphBoxes(root: Node): {
  glyphs: GlyphBox[];
  positions: Array<{ node: Text; offset: number }>;
} {
  const glyphs: GlyphBox[] = [];
  const positions: Array<{ node: Text; offset: number }> = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (!(node instanceof Text)) {
      node = walker.nextNode();
      continue;
    }
    const text = node.textContent ?? "";
    for (let offset = 0; offset < text.length; offset += 1) {
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, offset + 1);
      const rect = primaryClientRect(range);
      if (!rect) {
        continue;
      }
      glyphs.push({
        left: rect.left,
        top: rect.top,
        bottom: rect.bottom,
        index: positions.length,
      });
      positions.push({ node, offset });
    }
    node = walker.nextNode();
  }
  return { glyphs, positions };
}

/**
 * Visible box for a single-character range. Prefers getClientRects so soft wraps
 * do not collapse onto the first visual row.
 */
export function primaryClientRect(range: Range): {
  left: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
} | null {
  const rects = range.getClientRects();
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (rect.width > 0 || rect.height > 0) {
      return rect;
    }
  }
  const fallback = range.getBoundingClientRect();
  if (fallback.width > 0 || fallback.height > 0) {
    return fallback;
  }
  return null;
}

/**
 * DOM text position for a click inside `root`, constrained to the visual row.
 */
export function domPosFromGlyphPoint(
  root: Node,
  clientX: number,
  clientY: number,
): { node: Text; offset: number } | undefined {
  const { glyphs, positions } = collectGlyphBoxes(root);
  const index = glyphIndexAtPoint(glyphs, clientX, clientY);
  if (index === undefined) {
    return undefined;
  }
  if (index >= positions.length) {
    const last = positions[positions.length - 1];
    if (!last) {
      return undefined;
    }
    return { node: last.node, offset: last.offset + 1 };
  }
  return positions[index];
}

/**
 * Resolves which code-card line was hit and the column within `.md-code-src`.
 */
export function codeLineHitFromPoint(
  wrap: HTMLElement,
  clientX: number,
  clientY: number,
): { lineIndex: number; column: number } | undefined {
  const lines = [...wrap.querySelectorAll(".md-code-line")];
  if (lines.length === 0) {
    return undefined;
  }
  let row: Element | undefined;
  for (const line of lines) {
    const box = line.getBoundingClientRect();
    if (clientY >= box.top && clientY <= box.bottom) {
      row = line;
      break;
    }
  }
  if (!row) {
    const first = lines[0].getBoundingClientRect();
    row = clientY < first.top ? lines[0] : lines[lines.length - 1];
  }
  const lineIndex = lines.indexOf(row);
  const src = row.querySelector(".md-code-src");
  if (!(src instanceof HTMLElement)) {
    return { lineIndex, column: 0 };
  }
  return {
    lineIndex,
    column: displayOffsetFromPoint(src, clientX, clientY),
  };
}

/**
 * Source offset for a click inside a graphic code card.
 */
export function sourcePosFromCodeClick(
  bodyFrom: number,
  body: string,
  wrap: HTMLElement,
  clientX: number,
  clientY: number,
): number {
  const hit = codeLineHitFromPoint(wrap, clientX, clientY);
  if (!hit) {
    return bodyFrom;
  }
  return codeLineColumnToSource(bodyFrom, body, hit.lineIndex, hit.column);
}

/**
 * Source offset for a point inside a graphic table widget.
 */
export function sourcePosFromTablePoint(
  viewDocSlice: (from: number, to: number) => string,
  wrap: HTMLElement,
  clientX: number,
  clientY: number,
): number | undefined {
  const hit =
    (
      document.elementFromPoint(clientX, clientY) as HTMLElement | null
    )?.closest?.("th, td") ?? nearestTableCell(wrap, clientX, clientY);
  if (!(hit instanceof HTMLElement) || !wrap.contains(hit)) {
    return undefined;
  }
  if (hit.dataset.pos === undefined) {
    return undefined;
  }
  const from = Number(hit.dataset.pos);
  const to = hit.dataset.to !== undefined ? Number(hit.dataset.to) : from;
  return sourcePosFromCellClick(
    viewDocSlice(from, to),
    from,
    hit,
    clientX,
    clientY,
  );
}

function nearestTableCell(
  wrap: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement | undefined {
  const cells = [...wrap.querySelectorAll("th, td")];
  let best: HTMLElement | undefined;
  let bestDist = Infinity;
  for (const candidate of cells) {
    if (!(candidate instanceof HTMLElement)) {
      continue;
    }
    const box = candidate.getBoundingClientRect();
    const cx = Math.min(Math.max(clientX, box.left), box.right);
    const cy = Math.min(Math.max(clientY, box.top), box.bottom);
    const dist = (cx - clientX) ** 2 + (cy - clientY) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}
