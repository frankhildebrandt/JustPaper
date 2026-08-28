import { describe, expect, it } from "vitest";
import { displayOffsetToSource } from "./cellClick";
import { caretSkippedGraphic } from "./graphicNav";

describe("caretSkippedGraphic", () => {
  it("enters when motion lands on the widget start instead of skipping past", () => {
    const doc = "lead\n|a|\n|-|\n|b|\n";
    const span = { from: 5, to: 16 };
    expect(caretSkippedGraphic(doc, [span], 4, 5)).toBe(5);
  });
});

describe("displayOffsetToSource", () => {
  it("maps plain text one-to-one", () => {
    expect(displayOffsetToSource("Persistenz", 4)).toBe(4);
  });

  it("skips markdown marks that are not displayed", () => {
    expect(displayOffsetToSource("**Delta**", 0)).toBe(2);
    expect(displayOffsetToSource("**Delta**", 2)).toBe(4);
    expect(displayOffsetToSource("`id`", 0)).toBe(1);
    expect(displayOffsetToSource("`id`", 2)).toBe(4);
  });

  it("maps past a closed mark onto the following display character", () => {
    expect(displayOffsetToSource("`ab` cd", 2)).toBe(4);
    expect(displayOffsetToSource("`ab` cd", 3)).toBe(5);
  });
});
