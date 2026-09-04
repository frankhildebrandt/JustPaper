export type StartWatch = (
  path: string,
  onEvent: (eventPaths: string[]) => void,
) => Promise<() => void>;

export type OpenFileWatch = {
  follow: (path: string | null) => void;
  disconnect: () => void;
};

export const OPEN_FILE_WATCH_DELAY_MS = 200;

/**
 * Follows one open file and notifies only when that file's path appears in a watch event.
 */
export function bindOpenFileWatch(
  startWatch: StartWatch,
  onFileChanged: () => void,
): OpenFileWatch {
  let current: string | null = null;
  let stop: (() => void) | undefined;
  let generation = 0;

  const follow = (path: string | null): void => {
    if (path === current) {
      return;
    }
    stop?.();
    stop = undefined;
    current = path;
    const my = ++generation;
    if (path === null) {
      return;
    }
    void startWatch(path, (eventPaths) => {
      if (my !== generation) {
        return;
      }
      if (!eventPaths.includes(path)) {
        return;
      }
      onFileChanged();
    }).then((unwatch) => {
      if (my !== generation) {
        unwatch();
        return;
      }
      stop = unwatch;
    }).catch(() => undefined);
  };

  return {
    follow,
    disconnect: (): void => {
      follow(null);
    },
  };
}
