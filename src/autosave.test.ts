import { afterEach, describe, expect, it, vi } from "vitest";
import { bindAutosave } from "./autosave";

describe("bindAutosave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves once after the debounce window", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const autosave = bindAutosave(save, 800);

    autosave.schedule();
    autosave.schedule();
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flush saves immediately and cancels the pending timer", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const autosave = bindAutosave(save, 800);

    autosave.schedule();
    autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(800);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("cancel drops a pending save", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const autosave = bindAutosave(save, 800);

    autosave.schedule();
    autosave.cancel();
    vi.advanceTimersByTime(800);
    expect(save).not.toHaveBeenCalled();
  });
});
