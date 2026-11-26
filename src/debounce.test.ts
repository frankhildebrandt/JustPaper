import { afterEach, describe, expect, it, vi } from "vitest";
import { bindDebounce } from "./debounce";

describe("bindDebounce", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves once after the debounce window", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const debounced = bindDebounce(save, 800);

    debounced.schedule();
    debounced.schedule();
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flush saves immediately and cancels the pending timer", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const debounced = bindDebounce(save, 800);

    debounced.schedule();
    await debounced.flush();
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
    const debounced = bindDebounce(save, 800);

    debounced.schedule();
    await vi.advanceTimersByTimeAsync(800);
    debounced.schedule();
    const flushed = debounced.flush();

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
    const debounced = bindDebounce(save, 800);

    debounced.schedule();
    await vi.advanceTimersByTimeAsync(800);
    await expect(debounced.flush()).resolves.toBeUndefined();

    debounced.schedule();
    await expect(debounced.flush()).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("cancel drops a pending save", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const debounced = bindDebounce(save, 800);

    debounced.schedule();
    debounced.cancel();
    vi.advanceTimersByTime(800);
    expect(save).not.toHaveBeenCalled();
  });
});
