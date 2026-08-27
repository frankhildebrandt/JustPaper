import { describe, expect, it } from "vitest";
import { headingStyle } from "./headingStyle";

describe("headingStyle", () => {
  it("hangs the hash and its following gap for a first-level heading", () => {
    expect(headingStyle(1)).toEqual({
      gutter: "#",
      hangCh: 2,
      fontEm: 1.45,
      lineHeight: 1.55 / 1.45,
      marginBeforeEm: 0.3,
      marginAfterEm: 0.1,
    });
  });

  it("keeps a little more space above a heading than below", () => {
    expect(headingStyle(6)).toEqual({
      gutter: "######",
      hangCh: 7,
      fontEm: 1,
      lineHeight: 1.55,
      marginBeforeEm: 0.12,
      marginAfterEm: 0.05,
    });
    expect(headingStyle(6).fontEm).toBeLessThan(headingStyle(1).fontEm);
    expect(headingStyle(1).marginBeforeEm).toBeGreaterThan(
      headingStyle(1).marginAfterEm * 2,
    );
    expect(headingStyle(6).marginBeforeEm).toBeGreaterThan(
      headingStyle(6).marginAfterEm * 2,
    );
  });

  it("keeps heading lines on the body writing rhythm", () => {
    expect(headingStyle(1).lineHeight * headingStyle(1).fontEm).toBeCloseTo(1.55);
    expect(headingStyle(3).lineHeight * headingStyle(3).fontEm).toBeCloseTo(1.55);
  });
});
