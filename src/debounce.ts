export type Debounced = {
  schedule: () => void;
  flush: () => Promise<void>;
  cancel: () => void;
};

/**
 * Debounces `run` so it fires once after calls settle, serialised with any
 * still-running previous call, with explicit flush and cancel.
 */
export function bindDebounce(
  run: () => void | Promise<void>,
  delayMs: number,
): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = Promise.resolve();

  const cancel = (): void => {
    if (timer === undefined) {
      return;
    }
    clearTimeout(timer);
    timer = undefined;
  };

  const start = (): Promise<void> => {
    active = active.then(run).catch(() => undefined);
    return active;
  };

  const flush = (): Promise<void> => {
    if (timer !== undefined) {
      cancel();
      void start();
    }
    return active;
  };

  return {
    schedule: (): void => {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        void start().catch(() => undefined);
      }, delayMs);
    },
    flush,
    cancel,
  };
}
