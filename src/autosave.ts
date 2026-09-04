export const AUTOSAVE_DELAY_MS = 800;

export type Autosave = {
  schedule: () => void;
  flush: () => Promise<void>;
  cancel: () => void;
};

/**
 * Debounces `save` so it runs once after edits settle, with an explicit flush.
 */
export function bindAutosave(
  save: () => void | Promise<void>,
  delayMs: number = AUTOSAVE_DELAY_MS,
): Autosave {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = Promise.resolve();

  const cancel = (): void => {
    if (timer === undefined) {
      return;
    }
    clearTimeout(timer);
    timer = undefined;
  };

  const run = (): Promise<void> => {
    active = active.then(save).catch(() => undefined);
    return active;
  };

  const flush = (): Promise<void> => {
    if (timer !== undefined) {
      cancel();
      void run();
    }
    return active;
  };

  return {
    schedule: (): void => {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        void run().catch(() => undefined);
      }, delayMs);
    },
    flush,
    cancel,
  };
}
