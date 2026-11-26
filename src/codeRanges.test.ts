import { describe, expect, it } from "vitest";
import { codeRangeAt, codeRanges } from "./codeRanges";

describe("codeRanges", () => {
  it("finds inline code spans", () => {
    expect(codeRanges("a `b` c")).toEqual([{ from: 2, to: 5 }]);
  });

  it("closes only on a backtick run of the same length", () => {
    expect(codeRanges("``a ` b`` c")).toEqual([{ from: 0, to: 9 }]);
  });

  it("ignores an unmatched backtick", () => {
    expect(codeRanges("a ` b")).toEqual([]);
  });

  it("does not let inline code span lines", () => {
    expect(codeRanges("a `b\nc` d")).toEqual([]);
  });

  it("finds a fenced block", () => {
    expect(codeRanges("x\n```\ny\n```\nz")).toEqual([{ from: 2, to: 12 }]);
  });
});

describe("codeRangeAt", () => {
  it("returns the range containing an offset", () => {
    const ranges = [{ from: 2, to: 5 }];
    expect(codeRangeAt(ranges, 2)).toEqual({ from: 2, to: 5 });
    expect(codeRangeAt(ranges, 5)).toBeUndefined();
  });
});
