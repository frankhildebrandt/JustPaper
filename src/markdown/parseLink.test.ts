import { describe, expect, it } from "vitest";
import { parseInlineLink, externalLinkAt } from "./parseLink";

describe("parseInlineLink", () => {
  it("parses a markdown link with text and an http url", () => {
    expect(parseInlineLink("[docs](https://example.com)", 0)).toEqual({
      kind: "link",
      from: 0,
      to: 27,
      markOpen: { from: 0, to: 1 },
      markClose: { from: 5, to: 27 },
      label: { from: 1, to: 5 },
      href: "https://example.com",
      dest: { from: 7, to: 26 },
      alt: "docs",
    });
  });

  it("parses an image as a link-shaped span with kind image", () => {
    expect(parseInlineLink("![alt](pic.png)", 0)).toEqual({
      kind: "image",
      from: 0,
      to: 15,
      markOpen: { from: 0, to: 2 },
      markClose: { from: 5, to: 15 },
      label: { from: 2, to: 5 },
      href: "pic.png",
      dest: { from: 7, to: 14 },
      alt: "alt",
    });
  });

  it("preserves brackets in destinations", () => {
    expect(parseInlineLink("[docs](http://[::1]/x)", 0)?.href).toBe(
      "http://[::1]/x",
    );
    expect(parseInlineLink("![alt](foo[1].png)", 0)?.href).toBe("foo[1].png");
  });

  it("rejects a missing destination or a non-http scheme for links", () => {
    expect(parseInlineLink("[docs]()", 0)).toBeUndefined();
    expect(parseInlineLink("[docs](javascript:alert(1))", 0)).toBeUndefined();
    expect(parseInlineLink("plain", 0)).toBeUndefined();
  });

  it("rejects a nested opener before a closing label", () => {
    expect(
      parseInlineLink("[broken [docs](https://example.com)", 0),
    ).toBeUndefined();
  });
});

describe("externalLinkAt", () => {
  it("returns the http link whose range contains the caret", () => {
    const source = "see [docs](https://example.com) please";
    expect(externalLinkAt(source, 6)?.href).toBe("https://example.com");
    expect(externalLinkAt(source, 0)).toBeUndefined();
  });

  it("handles long runs of unmatched openers", () => {
    const source = "[a".repeat(500_000);
    const started = performance.now();
    expect(externalLinkAt(source, 0)).toBeUndefined();
    expect(performance.now() - started).toBeLessThan(500);
  });
});
