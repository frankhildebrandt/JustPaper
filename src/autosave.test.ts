import { afterEach, describe, expect, it, vi } from "vitest";
import { bindAutosave } from "./autosave";

describe("bindAutosave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves once after the debounce window", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const autosave = bindAutosave(save, 800);

    autosave.schedule();
    autosave.schedule();
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flush saves immediately and cancels the pending timer", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const autosave = bindAutosave(save, 800);

    autosave.schedule();
    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(800);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("waits for an active asynchronous save and serializes the next one", async () => {
    vi.useFakeTimers();
    let finishFirst: (() => void) | undefined;
    const save = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockResolvedValueOnce();
    const autosave = bindAutosave(save, 800);

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(800);
    autosave.schedule();
    const flushed = autosave.flush();

    expect(save).toHaveBeenCalledTimes(1);
    finishFirst?.();
    await flushed;
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("recovers after an asynchronous save fails", async () => {
    vi.useFakeTimers();
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("save failed"))
      .mockResolvedValueOnce();
    const autosave = bindAutosave(save, 800);

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(800);
    await expect(autosave.flush()).resolves.toBeUndefined();

    autosave.schedule();
    await expect(autosave.flush()).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(2);
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
