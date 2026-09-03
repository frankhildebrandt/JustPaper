import { describe, expect, it, vi } from "vitest";
import { bindOpenFileWatch } from "./openFileWatch";

describe("bindOpenFileWatch", () => {
  it("notifies when the followed file changes", async () => {
    const onFileChanged = vi.fn();
    let emit: ((paths: string[]) => void) | undefined;
    const watch = bindOpenFileWatch(async (_path, onEvent) => {
      emit = onEvent;
      return () => {};
    }, onFileChanged);

    watch.follow("/vault/notes.md");
    await Promise.resolve();
    emit?.(["/vault/notes.md"]);

    expect(onFileChanged).toHaveBeenCalledTimes(1);
  });

  it("ignores changes to sibling files", async () => {
    const onFileChanged = vi.fn();
    let emit: ((paths: string[]) => void) | undefined;
    const watch = bindOpenFileWatch(async (_path, onEvent) => {
      emit = onEvent;
      return () => {};
    }, onFileChanged);

    watch.follow("/vault/notes.md");
    await Promise.resolve();
    emit?.(["/vault/other.md"]);

    expect(onFileChanged).not.toHaveBeenCalled();
  });

  it("stops notifying after disconnect", async () => {
    const onFileChanged = vi.fn();
    let emit: ((paths: string[]) => void) | undefined;
    const watch = bindOpenFileWatch(async (_path, onEvent) => {
      emit = onEvent;
      return () => {};
    }, onFileChanged);

    watch.follow("/vault/notes.md");
    await Promise.resolve();
    watch.disconnect();
    emit?.(["/vault/notes.md"]);

    expect(onFileChanged).not.toHaveBeenCalled();
  });

  it("drops a watch that resolves after a newer follow", async () => {
    const onFileChanged = vi.fn();
    const unwatchOld = vi.fn();
    let emitOld: ((paths: string[]) => void) | undefined;
    let resolveOld: ((unwatch: () => void) => void) | undefined;
    const watch = bindOpenFileWatch((path, onEvent) => {
      if (path === "/vault/old.md") {
        emitOld = onEvent;
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      }
      return Promise.resolve(() => {});
    }, onFileChanged);

    watch.follow("/vault/old.md");
    watch.follow("/vault/new.md");
    resolveOld?.(unwatchOld);
    await Promise.resolve();
    emitOld?.(["/vault/old.md"]);

    expect(unwatchOld).toHaveBeenCalledTimes(1);
    expect(onFileChanged).not.toHaveBeenCalled();
  });
});
