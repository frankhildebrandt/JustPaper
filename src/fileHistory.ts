export type FileHistory = {
  back: string[];
  forward: string[];
};

export type FileHistoryHop = {
  history: FileHistory;
  path: string;
};

/**
 * Returns an empty visit stack.
 */
export function createFileHistory(): FileHistory {
  return { back: [], forward: [] };
}

/**
 * Records a leave from `from` after opening a different file.
 * Untitled buffers are not stored; forward is always cleared.
 */
export function recordVisit(
  history: FileHistory,
  from: string | null,
): FileHistory {
  if (from === null) {
    return { back: history.back, forward: [] };
  }
  return {
    back: [...history.back, from],
    forward: [],
  };
}

/**
 * Pops the previous file and parks `current` on the forward stack.
 */
export function goBack(
  history: FileHistory,
  current: string | null,
): FileHistoryHop | undefined {
  const path = history.back[history.back.length - 1];
  if (path === undefined) {
    return undefined;
  }
  return {
    path,
    history: {
      back: history.back.slice(0, -1),
      forward:
        current === null ? history.forward : [...history.forward, current],
    },
  };
}

/**
 * Pops the next file and parks `current` on the back stack.
 */
export function goForward(
  history: FileHistory,
  current: string | null,
): FileHistoryHop | undefined {
  const path = history.forward[history.forward.length - 1];
  if (path === undefined) {
    return undefined;
  }
  return {
    path,
    history: {
      back: current === null ? history.back : [...history.back, current],
      forward: history.forward.slice(0, -1),
    },
  };
}
