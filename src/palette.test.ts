import { describe, expect, it } from "vitest";
import { indexAfterPage } from "./palette";

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
