import { describe, expect, it } from "vitest";
import {
  createFileHistory,
  goBack,
  goForward,
  recordVisit,
} from "./fileHistory";

describe("recordVisit", () => {
  it("pushes the left file onto back and clears forward", () => {
    const history = recordVisit(
      { back: ["/a.md"], forward: ["/c.md"] },
      "/b.md",
    );
    expect(history).toEqual({ back: ["/a.md", "/b.md"], forward: [] });
  });

  it("does not store an untitled buffer", () => {
    expect(recordVisit({ back: ["/a.md"], forward: ["/b.md"] }, null)).toEqual({
      back: ["/a.md"],
      forward: [],
    });
  });
});

describe("goBack", () => {
  it("walks several hops and can return via forward", () => {
    let history = createFileHistory();
    history = recordVisit(history, "/a.md");
    history = recordVisit(history, "/b.md");
    const first = goBack(history, "/c.md");
    expect(first?.path).toBe("/b.md");
    const second = goBack(first!.history, "/b.md");
    expect(second?.path).toBe("/a.md");
    expect(second?.history.back).toEqual([]);
    const forward = goForward(second!.history, "/a.md");
    expect(forward?.path).toBe("/b.md");
  });

  it("returns undefined when back is empty", () => {
    expect(goBack(createFileHistory(), "/a.md")).toBeUndefined();
  });

  it("allows going back from an untitled buffer without parking it", () => {
    const history = recordVisit(createFileHistory(), "/a.md");
    const hop = goBack(history, null);
    expect(hop?.path).toBe("/a.md");
    expect(hop?.history.forward).toEqual([]);
  });
});

describe("goForward", () => {
  it("is empty after a new visit", () => {
    let history = createFileHistory();
    history = recordVisit(history, "/a.md");
    const back = goBack(history, "/b.md");
    history = recordVisit(back!.history, "/b.md");
    expect(goForward(history, "/c.md")).toBeUndefined();
  });

  it("returns undefined when forward is empty", () => {
    expect(goForward(createFileHistory(), "/a.md")).toBeUndefined();
  });
});
