import { describe, expect, it } from "vitest";
import { parseTodo, toggleTodoCheck } from "./parseTodo";

describe("parseTodo", () => {
  it("parses an open task with list mark, box, and content start", () => {
    expect(parseTodo("- [ ] milk", 0, 10)).toEqual({
      from: 0,
      to: 10,
      listMark: { from: 0, to: 2 },
      box: { from: 2, to: 5 },
      checked: false,
      contentFrom: 6,
    });
  });

  it("parses a checked task and accepts * or + bullets", () => {
    expect(parseTodo("- [x] done", 0, 10)?.checked).toBe(true);
    expect(parseTodo("- [X] done", 0, 10)?.checked).toBe(true);
    expect(parseTodo("* [ ] a", 0, 7)?.listMark).toEqual({ from: 0, to: 2 });
    expect(parseTodo("+ [ ] a", 0, 7)?.box).toEqual({ from: 2, to: 5 });
  });

  it("rejects a list item without a task box", () => {
    expect(parseTodo("- milk", 0, 6)).toBeUndefined();
    expect(parseTodo("[ ] milk", 0, 8)).toBeUndefined();
  });
});

describe("toggleTodoCheck", () => {
  it("checks an open box and unchecks a done box", () => {
    expect(toggleTodoCheck("- [ ] milk", 2)).toEqual({
      from: 3,
      to: 4,
      insert: "x",
    });
    expect(toggleTodoCheck("- [x] milk", 2)).toEqual({
      from: 3,
      to: 4,
      insert: " ",
    });
    expect(toggleTodoCheck("- [ ] milk", 4)?.insert).toBe("x");
  });

  it("returns undefined when the range is not a task box", () => {
    expect(toggleTodoCheck("- milk", 0)).toBeUndefined();
  });
});
