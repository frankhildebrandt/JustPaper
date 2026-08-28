import { describe, expect, it } from "vitest";
import {
  pointerHitsScrollbar,
  typewriterFollowAfterGesture,
} from "./typewriter";

describe("typewriterFollowAfterGesture", () => {
  it("releases follow on wheel and stays released", () => {
    expect(typewriterFollowAfterGesture("follow", { type: "wheel" })).toBe(
      "released",
    );
    expect(typewriterFollowAfterGesture("released", { type: "wheel" })).toBe(
      "released",
    );
  });

  it("releases follow on a scroller scroll", () => {
    expect(typewriterFollowAfterGesture("follow", { type: "scroll" })).toBe(
      "released",
    );
  });

  it("releases follow on a left click in the scroller content", () => {
    expect(
      typewriterFollowAfterGesture("follow", {
        type: "click",
        button: 0,
        onScrollbar: false,
      }),
    ).toBe("released");
    expect(
      typewriterFollowAfterGesture("released", {
        type: "click",
        button: 0,
        onScrollbar: false,
      }),
    ).toBe("released");
  });

  it("releases follow on a right click", () => {
    expect(
      typewriterFollowAfterGesture("follow", {
        type: "click",
        button: 2,
        onScrollbar: false,
      }),
    ).toBe("released");
  });

  it("releases follow when the pointer presses the scroller content", () => {
    expect(
      typewriterFollowAfterGesture("follow", {
        type: "pointerdown",
        button: 0,
        onScrollbar: false,
      }),
    ).toBe("released");
  });

  it("releases follow when the pointer presses the scrollbar", () => {
    expect(
      typewriterFollowAfterGesture("follow", {
        type: "pointerdown",
        button: 0,
        onScrollbar: true,
      }),
    ).toBe("released");
  });

  it("resumes follow on keyboard input", () => {
    expect(
      typewriterFollowAfterGesture("released", { type: "keydown", key: "a" }),
    ).toBe("follow");
    expect(
      typewriterFollowAfterGesture("released", {
        type: "keydown",
        key: "ArrowDown",
      }),
    ).toBe("follow");
  });

  it("does not resume follow on modifier keys", () => {
    expect(
      typewriterFollowAfterGesture("released", {
        type: "keydown",
        key: "Shift",
      }),
    ).toBe("released");
  });
});

describe("pointerHitsScrollbar", () => {
  it("treats a point past the client box as the scrollbar", () => {
    expect(pointerHitsScrollbar(200, 10, 190, 400)).toBe(true);
    expect(pointerHitsScrollbar(10, 410, 190, 400)).toBe(true);
    expect(pointerHitsScrollbar(10, 10, 190, 400)).toBe(false);
  });
});
