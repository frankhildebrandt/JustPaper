import { describe, expect, it } from "vitest";
import { activeAfterLoad, indexAfterPage, paletteStatusText } from "./palette";

describe("indexAfterPage", () => {
  it("moves down by a page of items", () => {
    expect(indexAfterPage(0, 10, 1, 3)).toBe(3);
  });

  it("moves up by a page of items", () => {
    expect(indexAfterPage(5, 10, -1, 3)).toBe(2);
  });

  it("clamps to the first and last item", () => {
    expect(indexAfterPage(8, 10, 1, 5)).toBe(9);
    expect(indexAfterPage(2, 10, -1, 5)).toBe(0);
  });

  it("stays at zero when the list is empty", () => {
    expect(indexAfterPage(0, 0, 1, 3)).toBe(0);
  });

  it("always moves at least one item", () => {
    expect(indexAfterPage(0, 4, 1, 0)).toBe(1);
  });
});

describe("activeAfterLoad", () => {
  it("resets to the first item when the query changed", () => {
    expect(activeAfterLoad(4, 10, true)).toBe(0);
  });

  it("keeps the selection for the same query, clamped to the list", () => {
    expect(activeAfterLoad(4, 10, false)).toBe(4);
    expect(activeAfterLoad(4, 2, false)).toBe(1);
  });

  it("stays at zero for an empty list", () => {
    expect(activeAfterLoad(3, 0, false)).toBe(0);
  });
});

describe("paletteStatusText", () => {
  it("reports a failed load in German", () => {
    expect(paletteStatusText({ itemCount: 0, failed: true })).toBe(
      "Ergebnisse konnten nicht geladen werden.",
    );
  });

  it("shows the empty text when there are no items", () => {
    expect(
      paletteStatusText({
        itemCount: 0,
        failed: false,
        emptyText: "Kein Projekt geöffnet",
      }),
    ).toBe("Kein Projekt geöffnet");
  });

  it("shows nothing when items exist or no empty text is set", () => {
    expect(
      paletteStatusText({ itemCount: 2, failed: false, emptyText: "leer" }),
    ).toBeUndefined();
    expect(paletteStatusText({ itemCount: 0, failed: false })).toBeUndefined();
  });
});
