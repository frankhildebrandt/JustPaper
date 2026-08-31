import { describe, expect, it } from "vitest";
import {
  WINDOW_CONTROLS_EDGE_PX,
  isWindowsChrome,
  windowControlsVisible,
  zoomAction,
} from "./windowChrome";
import { matchesAccelerator } from "./appMenu";

describe("windowControlsVisible", () => {
  it("shows the traffic lights at the top edge", () => {
    expect(windowControlsVisible(0)).toBe(true);
    expect(windowControlsVisible(WINDOW_CONTROLS_EDGE_PX)).toBe(true);
  });

  it("hides the traffic lights once the pointer leaves the top edge", () => {
    expect(windowControlsVisible(WINDOW_CONTROLS_EDGE_PX + 1)).toBe(false);
    expect(windowControlsVisible(200)).toBe(false);
  });
});

describe("zoomAction", () => {
  it("enters native fullscreen on a plain green-button click", () => {
    expect(zoomAction(false)).toBe("fullscreen");
  });

  it("maximizes when Option is held", () => {
    expect(zoomAction(true)).toBe("maximize");
  });

  it("always maximizes on Windows chrome", () => {
    expect(zoomAction(false, true)).toBe("maximize");
    expect(zoomAction(true, true)).toBe("maximize");
  });
});

describe("isWindowsChrome", () => {
  it("detects Windows user agents", () => {
    expect(isWindowsChrome("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      true,
    );
  });

  it("rejects macOS user agents", () => {
    expect(
      isWindowsChrome("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    ).toBe(false);
  });
});

function keyEvent(
  key: string,
  mods: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    code: string;
  }> = {},
): KeyboardEvent {
  return {
    key,
    code: mods.code ?? "",
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: mods.metaKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    altKey: mods.altKey ?? false,
  } as KeyboardEvent;
}

describe("matchesAccelerator", () => {
  it("matches CmdOrCtrl letter shortcuts", () => {
    expect(
      matchesAccelerator(keyEvent("s", { ctrlKey: true, code: "KeyS" }), "CmdOrCtrl+S"),
    ).toBe(true);
    expect(
      matchesAccelerator(keyEvent("s", { metaKey: true, code: "KeyS" }), "CmdOrCtrl+S"),
    ).toBe(true);
    expect(
      matchesAccelerator(keyEvent("s", { code: "KeyS" }), "CmdOrCtrl+S"),
    ).toBe(false);
  });

  it("matches shifted CmdOrCtrl shortcuts", () => {
    expect(
      matchesAccelerator(
        keyEvent("O", { ctrlKey: true, shiftKey: true, code: "KeyO" }),
        "Shift+CmdOrCtrl+O",
      ),
    ).toBe(true);
    expect(
      matchesAccelerator(
        keyEvent("O", { ctrlKey: true, code: "KeyO" }),
        "Shift+CmdOrCtrl+O",
      ),
    ).toBe(false);
  });

  it("matches function keys", () => {
    expect(matchesAccelerator(keyEvent("F11"), "F11")).toBe(true);
    expect(matchesAccelerator(keyEvent("F11", { ctrlKey: true }), "F11")).toBe(
      false,
    );
  });
});
