import { describe, expect, it } from "vitest";
import { isPrimaryClick, todoToggleOnLine } from "./todoToggle";

describe("todoToggleOnLine", () => {
  it("checks an open task on the caret line", () => {
    const source = "intro\n- [ ] buy milk";
    expect(todoToggleOnLine(source, 6, source.length)).toEqual({
      from: 9,
      to: 10,
      insert: "x",
    });
  });

  it("unchecks a done task", () => {
    expect(todoToggleOnLine("* [X] done", 0, 10)).toEqual({
      from: 3,
      to: 4,
      insert: " ",
    });
  });

  it("ignores lines that are not tasks", () => {
    expect(todoToggleOnLine("plain [ ] text", 0, 14)).toBeUndefined();
  });
});

describe("isPrimaryClick", () => {
  const click = (button: number, ctrlKey = false) => ({ button, ctrlKey });

  it("accepts a plain primary click", () => {
    expect(isPrimaryClick(click(0), true)).toBe(true);
    expect(isPrimaryClick(click(0), false)).toBe(true);
  });

  it("rejects secondary and middle buttons", () => {
    expect(isPrimaryClick(click(2), false)).toBe(false);
    expect(isPrimaryClick(click(1), false)).toBe(false);
  });

  it("rejects ctrl-click on macOS, which opens the context menu", () => {
    expect(isPrimaryClick(click(0, true), true)).toBe(false);
    expect(isPrimaryClick(click(0, true), false)).toBe(true);
  });
});
