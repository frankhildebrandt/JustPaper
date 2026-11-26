import { describe, expect, it } from "vitest";
import { followHrefAt, LINK_SELECTOR } from "./widgetLinks";

function linkTarget(href: string | null) {
  return {
    closest: (selector: string) =>
      selector === LINK_SELECTOR && href !== null
        ? { getAttribute: (name: string) => (name === "data-href" ? href : null) }
        : null,
  };
}

function click(
  target: unknown,
  modifiers: Partial<{ metaKey: boolean; ctrlKey: boolean; button: number }>,
) {
  return {
    target: target as EventTarget,
    button: modifiers.button ?? 0,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
  };
}

describe("followHrefAt", () => {
  it("follows a rendered link on Cmd/Ctrl-click like inline links", () => {
    const target = linkTarget("https://example.com");
    expect(followHrefAt(click(target, { metaKey: true }))).toBe(
      "https://example.com",
    );
    expect(followHrefAt(click(target, { ctrlKey: true }))).toBe(
      "https://example.com",
    );
  });

  it("ignores a plain click so it never navigates", () => {
    expect(
      followHrefAt(click(linkTarget("https://example.com"), {})),
    ).toBeUndefined();
  });

  it("ignores non-primary buttons and clicks outside links", () => {
    expect(
      followHrefAt(
        click(linkTarget("https://example.com"), { metaKey: true, button: 1 }),
      ),
    ).toBeUndefined();
    expect(followHrefAt(click(linkTarget(null), { metaKey: true }))).toBe(
      undefined,
    );
    expect(followHrefAt(click(null, { metaKey: true }))).toBeUndefined();
  });
});
