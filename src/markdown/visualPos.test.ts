import { describe, expect, it } from "vitest";
import {
  bestPosOnLineByCoords,
  clickPosMatchesPoint,
  codeLineColumnToSource,
  enterClientPoint,
  glyphIndexAtPoint,
  isVisualLineStep,
  visualLineProbeY,
  type GlyphBox,
} from "./visualPos";

describe("visualLineProbeY", () => {
  const caret = { left: 40, top: 100, bottom: 120 };

  it("probes below the caret box for ArrowDown", () => {
    expect(visualLineProbeY(caret, 1)).toBe(130);
  });

  it("probes above the caret box for ArrowUp", () => {
    expect(visualLineProbeY(caret, -1)).toBe(90);
  });
});

describe("isVisualLineStep", () => {
  it("rejects missing or no-op targets", () => {
    expect(isVisualLineStep(10, undefined)).toBe(false);
    expect(isVisualLineStep(10, 10)).toBe(false);
    expect(isVisualLineStep(10, 24)).toBe(true);
  });
});

describe("bestPosOnLineByCoords", () => {
  it("picks the soft-wrapped row under the click, not the first visual row", () => {
    // Row 0: positions 0..4 at y=100; row 1: 5..9 at y=130 (Recovery on row 1).
    const coordsAtPos = (pos: number) => {
      const row = pos < 5 ? 0 : 1;
      const col = pos < 5 ? pos : pos - 5;
      return {
        left: 10 + col * 10,
        top: 100 + row * 30,
        bottom: 118 + row * 30,
      };
    };
    expect(bestPosOnLineByCoords(0, 9, 35, 145, coordsAtPos)).toBe(7);
    expect(bestPosOnLineByCoords(0, 9, 35, 110, coordsAtPos)).toBe(2);
  });

  it("stays on the wrap row when clicking past its last glyph", () => {
    const coordsAtPos = (pos: number) => {
      const row = pos < 5 ? 0 : 1;
      const col = pos < 5 ? pos : pos - 5;
      return {
        left: 10 + col * 10,
        top: 100 + row * 30,
        bottom: 118 + row * 30,
      };
    };
    // Past end of row 0 (last left=50) — must not jump to row 1.
    expect(bestPosOnLineByCoords(0, 9, 80, 110, coordsAtPos)).toBe(5);
  });
});

describe("clickPosMatchesPoint", () => {
  it("rejects a caret that landed on a different visual row", () => {
    expect(
      clickPosMatchesPoint(100, 200, { left: 100, top: 100, bottom: 118 }),
    ).toBe(false);
    expect(
      clickPosMatchesPoint(100, 200, { left: 100, top: 190, bottom: 208 }),
    ).toBe(true);
  });
});

describe("glyphIndexAtPoint", () => {
  const row = (top: number, lefts: number[], start = 0): GlyphBox[] =>
    lefts.map((left, index) => ({
      left,
      top,
      bottom: top + 20,
      index: start + index,
    }));

  it("stays on the visual row end when the click is past the last glyph", () => {
    // Soft-wrapped line: "Recovery-" on row 0, "Pfaden." on row 1.
    const glyphs = [
      ...row(100, [10, 20, 30, 40, 50, 60, 70, 80, 90], 0),
      ...row(130, [10, 20, 30, 40, 50, 60, 70], 9),
    ];
    // Click in the padding after "Recovery-" — must not jump to row 1 / later text.
    expect(glyphIndexAtPoint(glyphs, 120, 110)).toBe(9);
  });

  it("picks the glyph under the cursor on the matching row", () => {
    const glyphs = [
      ...row(100, [10, 20, 30, 40], 0),
      ...row(130, [10, 20, 30, 40], 4),
    ];
    expect(glyphIndexAtPoint(glyphs, 30, 110)).toBe(2);
    expect(glyphIndexAtPoint(glyphs, 30, 140)).toBe(6);
  });

  it("does not fall onto a shorter following row when Y is slightly off", () => {
    // Mid-paragraph "Recovery-Pfaden" row vs short last row "werden."
    const glyphs = [
      ...row(100, [100, 110, 120, 130, 140, 150, 160, 170, 180], 0),
      ...row(130, [100, 110, 120, 130, 140, 150, 160], 9),
    ];
    // Click at Recovery's x but 2px below the row box — must stay on Recovery row.
    const index = glyphIndexAtPoint(glyphs, 175, 122);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(9);
  });
});

describe("codeLineColumnToSource", () => {
  it("maps a visual line/column in the code body to the document offset", () => {
    // open fence ends at 4: "```\n" then body "ab\ncd"
    const bodyFrom = 4;
    const body = "ab\ncd";
    expect(codeLineColumnToSource(bodyFrom, body, 0, 0)).toBe(4);
    expect(codeLineColumnToSource(bodyFrom, body, 0, 1)).toBe(5);
    expect(codeLineColumnToSource(bodyFrom, body, 1, 0)).toBe(7);
    expect(codeLineColumnToSource(bodyFrom, body, 1, 2)).toBe(9);
  });

  it("clamps columns past the end of a line to the line end", () => {
    expect(codeLineColumnToSource(0, "hi", 0, 99)).toBe(2);
  });
});

describe("enterClientPoint", () => {
  const widget = { left: 100, top: 200, right: 400, bottom: 320 };

  it("keeps the caret column when entering a widget from above", () => {
    const caret = { left: 250, top: 180, bottom: 196 };
    expect(enterClientPoint(caret, widget, 1, "along")).toEqual({
      x: 250,
      y: 204,
    });
  });

  it("keeps the caret column when entering a widget from below", () => {
    const caret = { left: 250, top: 340, bottom: 356 };
    expect(enterClientPoint(caret, widget, -1, "along")).toEqual({
      x: 250,
      y: 316,
    });
  });

  it("clamps the column into the widget horizontally", () => {
    const caret = { left: 10, top: 180, bottom: 196 };
    expect(enterClientPoint(caret, widget, 1, "along").x).toBe(102);
  });
});
