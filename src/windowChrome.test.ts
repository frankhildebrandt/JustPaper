import { describe, expect, it } from "vitest";
import {
  WINDOW_CONTROLS_EDGE_PX,
  windowControlsVisible,
  zoomAction,
} from "./windowChrome";

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
});
