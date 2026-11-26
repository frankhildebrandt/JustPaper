import { describe, expect, it } from "vitest";
import { parseFence } from "./parseFence";

describe("parseFence", () => {
  it("parses a closed fenced code block with a language tag", () => {
    const source = "```ts\nconst x = 1\n```\n";
    expect(parseFence(source, 0)).toEqual({
      from: 0,
      to: 22,
      next: 22,
      open: { from: 0, to: 6 },
      close: { from: 18, to: 22 },
      language: "ts",
    });
  });

  it("extends to the end of the document when the fence is unclosed", () => {
    const source = "```\nstill";
    expect(parseFence(source, 0)).toEqual({
      from: 0,
      to: 9,
      next: 9,
      open: { from: 0, to: 4 },
      close: undefined,
      language: "",
    });
  });

  it("returns undefined when the line is not a backtick fence", () => {
    expect(parseFence("plain", 0)).toBeUndefined();
  });
});

describe("parseFence run lengths", () => {
  it("requires a closing run at least as long as the opening run", () => {
    const source = "````md\n```\ninner\n```\n````\nafter";
    const fence = parseFence(source, 0);
    expect(fence?.language).toBe("md");
    expect(fence?.close).toEqual({ from: 21, to: 26 });
  });

  it("accepts a longer closing run", () => {
    const source = "```\nx\n`````\n";
    expect(parseFence(source, 0)?.close).toEqual({ from: 6, to: 12 });
  });

  it("does not close on a shorter run", () => {
    const source = "````\nx\n```\n";
    expect(parseFence(source, 0)?.close).toBeUndefined();
  });

  it("rejects an opening line whose info string contains a backtick", () => {
    expect(parseFence("```foo``` text\nnext", 0)).toBeUndefined();
  });
});
