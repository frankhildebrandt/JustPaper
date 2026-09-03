import { createTagCache, type TagNote } from "./tagCache";

export const PROJECT_TAG_WATCH_DELAY_MS = 200;

export type StartProjectWatch = (
  root: string,
  onEvent: (eventPaths: string[]) => void,
) => Promise<() => void>;

export type ProjectTagIndexDeps = {
  readNotes: (root: string) => Promise<TagNote[]>;
  readFile: (absolutePath: string) => Promise<string | null>;
  startWatch: StartProjectWatch;
};

export type ProjectTagIndex = {
  follow: (root: string | null, restrictTo?: readonly string[]) => void;
  setFile: (relativePath: string, content: string | null) => void;
  tagsFor: (relativePath: string) => string[];
  disconnect: () => void;
};

/**
 * Builds a tag cache in the background and keeps it current from watches and edits.
 */
export function bindProjectTagIndex(
  deps: ProjectTagIndexDeps,
): ProjectTagIndex {
  const cache = createTagCache();
  let root: string | null = null;
  let allowed: Set<string> | undefined;
  let stop: (() => void) | undefined;
  let generation = 0;

  const unwatch = (): void => {
    stop?.();
    stop = undefined;
  };

  const follow = (nextRoot: string | null, restrictTo?: readonly string[]): void => {
    unwatch();
    cache.clear();
    root = nextRoot;
    allowed = restrictTo === undefined ? undefined : new Set(restrictTo);
    const my = ++generation;
    if (nextRoot === null) {
      return;
    }
    const rebuild = cache.beginRebuild();
    void deps.readNotes(nextRoot).then((notes) => {
      if (my !== generation) {
        return;
      }
      cache.replaceAll(filterNotes(notes, allowed), rebuild);
    }).catch(() => undefined);
    void deps.startWatch(nextRoot, (eventPaths) => {
      if (my !== generation || root === null) {
        return;
      }
      for (const absolute of eventPaths) {
        const relative = relativeFromRoot(root, absolute);
        if (relative === undefined || !isNote(relative)) {
          continue;
        }
        if (allowed !== undefined && !allowed.has(relative)) {
          continue;
        }
        void deps.readFile(absolute).then((content) => {
          if (my !== generation) {
            return;
          }
          cache.setFile(relative, content);
        });
      }
    }).then((unlisten) => {
      if (my !== generation) {
        unlisten();
        return;
      }
      stop = unlisten;
    });
  };

  return {
    follow,
    setFile: (relativePath, content): void => {
      cache.setFile(relativePath, content);
    },
    tagsFor: (relativePath): string[] => cache.tagsFor(relativePath),
    disconnect: (): void => {
      follow(null);
    },
  };
}

function filterNotes(
  notes: readonly TagNote[],
  allowed: Set<string> | undefined,
): TagNote[] {
  if (allowed === undefined) {
    return [...notes];
  }
  return notes.filter((note) => allowed.has(note.path));
}

function relativeFromRoot(root: string, path: string): string | undefined {
  const prefix = `${root.replace(/\/+$/, "")}/`;
  const normalized = path.replace(/\\/g, "/");
  if (!normalized.startsWith(prefix)) {
    return undefined;
  }
  return normalized.slice(prefix.length);
}

function isNote(path: string): boolean {
  return /\.(md|txt|typ)$/i.test(path);
}
