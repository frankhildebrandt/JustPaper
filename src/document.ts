import { message, open, save } from "@tauri-apps/plugin-dialog";
import {
  exists,
  mkdir,
  readTextFile,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AUTOSAVE_DELAY_MS, bindAutosave } from "./autosave";
import {
  applyForgetRecent,
  applyNew,
  applyOpen,
  applyOpenFolder,
  applyRename,
  applySave,
  createDocumentSession,
  isDirty,
  type DocumentSession,
} from "./documentSession";
import {
  displayName,
  renamePath,
  untitledCreatePath,
} from "./filename";
import {
  listProjectFiles,
  readProjectNotes,
  searchProject,
  type ProjectNote,
  type SearchHit,
} from "./projectIndex";
import {
  parseRecentFiles,
  serializeRecentFiles,
} from "./recentFiles";
import {
  caretFor,
  clampCaretOffset,
  parseStoredSession,
  pruneCarets,
  rememberCaret,
  renameCaret,
  serializeStoredSession,
} from "./storedSession";
import {
  resolveWikiLink,
  wikiCreatePath,
} from "./wikiLink";

const RECENT_STORAGE_KEY = "justpaper.recentFiles";
const PROJECT_STORAGE_KEY = "justpaper.project";
const SAVE_BUTTON = "Save";
const DISCARD_BUTTON = "Don't Save";
const CANCEL_BUTTON = "Cancel";
const FILE_FILTERS = [
  { name: "Markdown", extensions: ["md"] },
  { name: "Text", extensions: ["txt"] },
];
const DOCUMENT_START_LINE = 1;

export type { SearchHit, ProjectNote };

export type DocumentContent = {
  getText: () => string;
  setText: (text: string, caretLine?: number) => void;
  getCaretOffset: () => number;
  setCaretOffset: (offset: number) => void;
  revealCaret: () => void;
  focus: () => void;
  onChange: (listener: () => void) => () => void;
  onCaretOrDoc: (listener: () => void) => () => void;
};

export type DocumentBinding = {
  newDocument: () => Promise<void>;
  open: () => Promise<void>;
  openFolder: () => Promise<void>;
  save: () => Promise<boolean>;
  saveAs: () => Promise<boolean>;
  rename: (nextDisplayName: string) => Promise<boolean>;
  openRecent: (path: string) => Promise<void>;
  openProjectFile: (relativePath: string, caretLine?: number) => Promise<void>;
  followWiki: (target: string) => Promise<void>;
  listFiles: () => Promise<string[]>;
  readNotes: () => Promise<ProjectNote[]>;
  search: (query: string) => Promise<SearchHit[]>;
  path: () => string | null;
  projectRoot: () => string | null;
  recents: () => string[];
  onRecentsChange: (listener: () => void) => () => void;
  onSessionChange: (listener: () => void) => () => void;
  disconnect: () => void;
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function loadStoredSession(): ReturnType<typeof parseStoredSession> {
  try {
    return parseStoredSession(localStorage.getItem(PROJECT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function loadRecents(): string[] {
  try {
    return parseRecentFiles(localStorage.getItem(RECENT_STORAGE_KEY));
  } catch {
    return [];
  }
}

function persistRecents(session: DocumentSession): void {
  localStorage.setItem(
    RECENT_STORAGE_KEY,
    serializeRecentFiles(session.recents),
  );
}

function fileName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function isUnderRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root.replace(/\/+$/, "")}/`);
}

function joinRoot(root: string, relative: string): string {
  return `${root.replace(/\/+$/, "")}/${relative.replace(/^\/+/, "")}`;
}

function parentDir(path: string): string | undefined {
  const trimmed = path.replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) {
    return undefined;
  }
  return trimmed.slice(0, slash);
}

/**
 * Binds New / Open / Save / Save As / recents to editor content.
 */
export function bindDocument(content: DocumentContent): DocumentBinding {
  let session = createDocumentSession(loadRecents());
  const recentsListeners = new Set<() => void>();
  const sessionListeners = new Set<() => void>();
  let unlistenClose: (() => void) | undefined;
  let applying = false;
  const stored = loadStoredSession();
  let carets = stored?.carets ?? {};
  if (stored?.root) {
    session = applyOpenFolder(session, stored.root);
  }

  const captureCaret = (): void => {
    if (applying || session.path === null) {
      return;
    }
    carets = rememberCaret(carets, session.path, content.getCaretOffset());
  };

  const persistSession = (): void => {
    captureCaret();
    const keep = [...session.recents];
    if (session.path !== null) {
      keep.push(session.path);
    }
    carets = pruneCarets(carets, keep);
    localStorage.setItem(
      PROJECT_STORAGE_KEY,
      serializeStoredSession({
        root: session.projectRoot,
        lastFile: session.path,
        carets,
      }),
    );
  };

  const notify = (previous: DocumentSession): void => {
    persistRecents(session);
    persistSession();
    if (previous.recents.join("\0") !== session.recents.join("\0")) {
      for (const listener of recentsListeners) {
        listener();
      }
    }
    if (
      previous.path !== session.path ||
      previous.projectRoot !== session.projectRoot
    ) {
      for (const listener of sessionListeners) {
        listener();
      }
    }
  };

  const showError = async (text: string): Promise<void> => {
    if (!isTauriRuntime()) {
      return;
    }
    await message(text, { title: "JustPaper", kind: "error" });
  };

  const confirmProceed = async (): Promise<boolean> => {
    if (!isDirty(session, content.getText())) {
      return true;
    }
    if (!isTauriRuntime()) {
      return true;
    }
    const choice = await message("Do you want to save the changes you made?", {
      title: "JustPaper",
      kind: "warning",
      buttons: {
        yes: SAVE_BUTTON,
        no: DISCARD_BUTTON,
        cancel: CANCEL_BUTTON,
      },
    });
    if (choice === SAVE_BUTTON) {
      return saveDocument();
    }
    return choice === DISCARD_BUTTON;
  };

  const writeTo = async (path: string): Promise<boolean> => {
    const text = content.getText();
    try {
      await writeTextFile(path, text);
    } catch {
      await showError(`“${fileName(path)}” could not be saved.`);
      return false;
    }
    const previous = session;
    session = applySave(session, path, text);
    notify(previous);
    return true;
  };

  const saveAsDocument = async (defaultPath?: string): Promise<boolean> => {
    if (!isTauriRuntime()) {
      return false;
    }
    const path = await save({
      filters: FILE_FILTERS,
      defaultPath: defaultPath ?? session.path ?? "Untitled.md",
    });
    if (path === null) {
      return false;
    }
    return writeTo(path);
  };

  const saveDocument = async (): Promise<boolean> => {
    if (session.path === null) {
      return saveAsDocument();
    }
    return writeTo(session.path);
  };

  const autosave = bindAutosave(() => {
    if (session.projectRoot === null || session.path === null) {
      return;
    }
    if (!isDirty(session, content.getText())) {
      return;
    }
    void writeTo(session.path);
  }, AUTOSAVE_DELAY_MS);

  const adoptFile = async (
    path: string,
    caretLine?: number,
  ): Promise<void> => {
    let text: string;
    try {
      text = await readTextFile(path);
    } catch {
      const previous = session;
      session = applyForgetRecent(session, path);
      notify(previous);
      await showError(`“${fileName(path)}” could not be opened.`);
      return;
    }
    const previous = session;
    session = applyOpen(session, path, text);
    applying = true;
    content.setText(text, caretLine);
    if (caretLine === undefined) {
      content.setCaretOffset(
        clampCaretOffset(caretFor(carets, path), text.length),
      );
    }
    applying = false;
    notify(previous);
    content.focus();
    content.revealCaret();
  };

  const switchTo = async (
    path: string,
    caretLine?: number,
  ): Promise<void> => {
    autosave.flush();
    if (session.path === path) {
      if (caretLine !== undefined) {
        content.setText(content.getText(), caretLine);
      }
      content.focus();
      return;
    }
    if (!(await confirmProceed())) {
      return;
    }
    await adoptFile(path, caretLine);
  };

  const newDocument = async (): Promise<void> => {
    autosave.flush();
    if (!(await confirmProceed())) {
      return;
    }
    const previous = session;
    session = applyNew(session);
    applying = true;
    content.setText("");
    applying = false;
    notify(previous);
    content.focus();
  };

  const openDocument = async (): Promise<void> => {
    autosave.flush();
    if (!(await confirmProceed())) {
      return;
    }
    if (!isTauriRuntime()) {
      return;
    }
    const path = await open({
      multiple: false,
      directory: false,
      filters: FILE_FILTERS,
    });
    if (typeof path !== "string") {
      return;
    }
    await adoptFile(path, DOCUMENT_START_LINE);
  };

  const openFolder = async (): Promise<void> => {
    if (!isTauriRuntime()) {
      return;
    }
    const root = await open({
      multiple: false,
      directory: true,
    });
    if (typeof root !== "string") {
      return;
    }
    autosave.flush();
    if (!(await confirmProceed())) {
      return;
    }
    const previous = session;
    session = applyOpenFolder(session, root);
    if (session.path !== null && !isUnderRoot(session.path, root)) {
      session = applyNew(session);
      applying = true;
      content.setText("");
      applying = false;
    }
    notify(previous);
    content.focus();
  };

  const renameDocument = async (nextDisplayName: string): Promise<boolean> => {
    const typed = nextDisplayName.trim();
    if (typed === displayName(session.path)) {
      return true;
    }
    if (!isTauriRuntime()) {
      return false;
    }
    if (session.path === null) {
      if (session.projectRoot !== null) {
        const dest = untitledCreatePath(session.projectRoot, typed);
        if (dest === undefined) {
          return false;
        }
        if (await exists(dest)) {
          await showError(`“${fileName(dest)}” already exists.`);
          return false;
        }
        return writeTo(dest);
      }
      const dest = untitledCreatePath("/untitled", typed);
      if (dest === undefined) {
        return false;
      }
      return saveAsDocument(fileName(dest));
    }
    const dest = renamePath(session.path, typed);
    if (dest === undefined) {
      return false;
    }
    if (dest === session.path) {
      return true;
    }
    if (await exists(dest)) {
      await showError(`“${fileName(dest)}” already exists.`);
      return false;
    }
    autosave.flush();
    try {
      await rename(session.path, dest);
    } catch {
      await showError(`“${displayName(session.path)}” could not be renamed.`);
      return false;
    }
    carets = renameCaret(carets, session.path, dest);
    const previous = session;
    session = applyRename(session, dest);
    notify(previous);
    return true;
  };

  const openRecent = async (path: string): Promise<void> => {
    await switchTo(path);
  };

  const openProjectFile = async (
    relativePath: string,
    caretLine?: number,
  ): Promise<void> => {
    if (session.projectRoot === null) {
      return;
    }
    await switchTo(
      joinRoot(session.projectRoot, relativePath),
      caretLine ?? DOCUMENT_START_LINE,
    );
  };

  const listFiles = async (): Promise<string[]> => {
    if (session.projectRoot === null) {
      return [];
    }
    return listProjectFiles(session.projectRoot);
  };

  const readNotes = async (): Promise<ProjectNote[]> => {
    if (session.projectRoot === null) {
      return [];
    }
    return readProjectNotes(session.projectRoot);
  };

  const search = async (query: string): Promise<SearchHit[]> => {
    if (session.projectRoot === null) {
      return [];
    }
    return searchProject(session.projectRoot, query);
  };

  const followWiki = async (target: string): Promise<void> => {
    if (session.projectRoot === null) {
      return;
    }
    autosave.flush();
    const files = await listFiles();
    const relative = resolveWikiLink(target, files);
    const dest =
      relative === undefined
        ? wikiCreatePath(target, session.projectRoot, session.path)
        : joinRoot(session.projectRoot, relative);
    if (relative === undefined) {
      if (await exists(dest)) {
        await switchTo(dest);
        return;
      }
      const parent = parentDir(dest);
      if (parent) {
        try {
          await mkdir(parent, { recursive: true });
        } catch {
          await showError(`“${fileName(dest)}” could not be created.`);
          return;
        }
      }
      try {
        await writeTextFile(dest, "");
      } catch {
        await showError(`“${fileName(dest)}” could not be created.`);
        return;
      }
    }
    await switchTo(dest);
  };

  const stopChange = content.onChange(() => {
    if (applying) {
      return;
    }
    if (session.projectRoot === null || session.path === null) {
      return;
    }
    autosave.schedule();
  });
  const caretPersist = bindAutosave(() => {
    persistSession();
  }, 400);
  const stopCaret = content.onCaretOrDoc(() => {
    if (applying) {
      return;
    }
    captureCaret();
    caretPersist.schedule();
  });

  if (isTauriRuntime()) {
    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        captureCaret();
        caretPersist.flush();
        persistSession();
        autosave.flush();
        if (!(await confirmProceed())) {
          event.preventDefault();
        }
      })
      .then((unlisten) => {
        unlistenClose = unlisten;
      });
    if (stored?.lastFile) {
      void adoptFile(stored.lastFile);
    }
  }

  return {
    newDocument,
    open: openDocument,
    openFolder,
    save: saveDocument,
    saveAs: () => saveAsDocument(),
    rename: renameDocument,
    openRecent,
    openProjectFile,
    followWiki,
    listFiles,
    readNotes,
    search,
    path: () => session.path,
    projectRoot: () => session.projectRoot,
    recents: () => session.recents,
    onRecentsChange: (listener: () => void): (() => void) => {
      recentsListeners.add(listener);
      return () => {
        recentsListeners.delete(listener);
      };
    },
    onSessionChange: (listener: () => void): (() => void) => {
      sessionListeners.add(listener);
      return () => {
        sessionListeners.delete(listener);
      };
    },
    disconnect: (): void => {
      captureCaret();
      caretPersist.flush();
      persistSession();
      autosave.cancel();
      stopChange();
      stopCaret();
      unlistenClose?.();
      recentsListeners.clear();
      sessionListeners.clear();
    },
  };
}
