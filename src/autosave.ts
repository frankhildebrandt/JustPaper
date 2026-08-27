export const AUTOSAVE_DELAY_MS = 800;

export type Autosave = {
  schedule: () => void;
  flush: () => void;
  cancel: () => void;
};

/**
 * Debounces `save` so it runs once after edits settle, with an explicit flush.
 */
export function bindAutosave(
  save: () => void,
  delayMs: number = AUTOSAVE_DELAY_MS,
): Autosave {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = (): void => {
    if (timer === undefined) {
      return;
    }
    clearTimeout(timer);
    timer = undefined;
  };

  const flush = (): void => {
    if (timer === undefined) {
      return;
    }
    cancel();
    save();
  };

  return {
    schedule: (): void => {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        save();
      }, delayMs);
    },
    flush,
    cancel,
  };
}
