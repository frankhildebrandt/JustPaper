import { message, open, save } from "@tauri-apps/plugin-dialog";
import {
  exists,
  lstat,
  mkdir,
  open as openFsFile,
  rename,
  watch,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AUTOSAVE_DELAY_MS, bindAutosave } from "./autosave";
import {
  applyForgetRecent,
  applyNew,
  applyOpen,
  applyOpenFolder,
  applyOpenTypstDocument,
  applyRename,
  applySave,
  createDocumentSession,
  isDirty,
  shouldApplyDiskText,
  type DocumentSession,
} from "./documentSession";
import {
  dirname,
  displayName,
  renamePath,
  untitledCreatePath,
} from "./filename";
import {
  bindOpenFileWatch,
  OPEN_FILE_WATCH_DELAY_MS,
} from "./openFileWatch";
import {
  bindProjectTagIndex,
  PROJECT_TAG_WATCH_DELAY_MS,
} from "./projectTagIndex";
import {
  listProjectAssets,
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
import { searchLines } from "./searchLines";
import {
  appendTypstInclude,
  collectTypstProjectFiles,
  MAX_TYPST_PROJECT_CHARS,
  resolveTypstInclude,
} from "./typst/includes";
import {
  createFileHistory,
  goBack as hopBack,
  goForward as hopForward,
  recordVisit,
} from "./fileHistory";
import { openLocalPath } from "./openLocalPath";
import {
  isNotePath,
  isWikiAssetTarget,
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
  { name: "Typst", extensions: ["typ"] },
  { name: "Text", extensions: ["txt"] },
];
const TYPST_FILTERS = [{ name: "Typst", extensions: ["typ"] }];
const DOCUMENT_START_LINE = 1;
const SEARCH_LIMIT = 200;
export const MAX_DOCUMENT_BYTES = 5_000_000;

class DocumentTooLargeError extends Error {}

export type { SearchHit, ProjectNote };

export type DocumentContent = {
  getText: () => string;
  setText: (text: string, caretLine?: number, resetUndo?: boolean) => void;
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
  openTypstDocument: () => Promise<void>;
  save: () => Promise<boolean>;
  saveAs: () => Promise<boolean>;
  rename: (nextDisplayName: string) => Promise<boolean>;
  openRecent: (path: string) => Promise<void>;
  openProjectFile: (relativePath: string, caretLine?: number) => Promise<void>;
  followWiki: (target: string) => Promise<void>;
  followTypstInclude: (includePath: string) => Promise<void>;
  listFiles: () => Promise<string[]>;
  listAssets: () => Promise<string[]>;
  readNotes: () => Promise<ProjectNote[]>;
  search: (query: string) => Promise<SearchHit[]>;
  tagsFor: (relativePath: string) => string[];
  path: () => string | null;
  projectRoot: () => string | null;
  typstMain: () => string | null;
  recents: () => string[];
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
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
  try {
    localStorage.setItem(
      RECENT_STORAGE_KEY,
      serializeRecentFiles(session.recents),
    );
  } catch {
    // Persistence is best-effort; a storage quota must not break file I/O.
  }
}

function fileName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function isUnderRoot(path: string, root: string): boolean {
  const normalizedPath = normalizeFsPath(path);
  const normalizedRoot = normalizeFsPath(root).replace(/\/+$/, "");
  const caseInsensitive = /^[a-z]:(?:\/|$)/i.test(normalizedRoot);
  const candidate = caseInsensitive ? normalizedPath.toLowerCase() : normalizedPath;
  const boundary = caseInsensitive ? normalizedRoot.toLowerCase() : normalizedRoot;
  return candidate === boundary || candidate.startsWith(`${boundary}/`);
}

function joinRoot(root: string, relative: string): string {
  return `${normalizeFsPath(root).replace(/\/+$/, "")}/${normalizeFsPath(relative).replace(/^\/+/, "")}`;
}

function relativeFromRoot(root: string, path: string): string | undefined {
  const normalizedRoot = normalizeFsPath(root).replace(/\/+$/, "");
  const normalizedPath = normalizeFsPath(path);
  const prefix = `${normalizedRoot}/`;
  const caseInsensitive = /^[a-z]:(?:\/|$)/i.test(normalizedRoot);
  if (
    !(caseInsensitive ? normalizedPath.toLowerCase() : normalizedPath).startsWith(
      caseInsensitive ? prefix.toLowerCase() : prefix,
    )
  ) {
    return undefined;
  }
  return normalizedPath.slice(prefix.length);
}

function parentDir(path: string): string | undefined {
  const trimmed = normalizeFsPath(path).replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) {
    return undefined;
  }
  return trimmed.slice(0, slash);
}

function normalizeFsPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function isSafeProjectRelative(path: string): boolean {
  const normalized = normalizeFsPath(path);
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[a-z]:/i.test(normalized)
  ) {
    return false;
  }
  let depth = 0;
  for (const part of normalized.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
      continue;
    }
    depth += 1;
  }
  return depth > 0;
}

async function readDocumentText(path: string): Promise<string> {
  const file = await openFsFile(path, { read: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let bytesRead = 0;
  try {
    while (true) {
      const remaining = MAX_DOCUMENT_BYTES - bytesRead;
      const buffer = new Uint8Array(Math.min(64 * 1024, remaining + 1));
      const count = await file.read(buffer);
      if (count === null) {
        chunks.push(decoder.decode());
        return chunks.join("");
      }
      bytesRead += count;
      if (bytesRead > MAX_DOCUMENT_BYTES) {
        throw new DocumentTooLargeError();
      }
      chunks.push(decoder.decode(buffer.subarray(0, count), { stream: true }));
    }
  } finally {
    await file.close();
  }
}

async function isContainedDestination(
  root: string,
  destination: string,
): Promise<boolean> {
  const relative = relativeFromRoot(root, destination);
  if (relative === undefined || !isSafeProjectRelative(relative)) {
    return false;
  }
  try {
    let current = normalizeFsPath(root).replace(/\/+$/, "");
    for (const part of normalizeFsPath(relative).split("/")) {
      if (part === "" || part === ".") {
        continue;
      }
      current = `${current}/${part}`;
      if (!(await exists(current))) {
        break;
      }
      if ((await lstat(current)).isSymlink) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
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
  let syncTagIndex = (): void => undefined;
  let indexOpenFile = (): void => undefined;
  const stored = loadStoredSession();
  let carets = stored?.carets ?? {};
  let history = createFileHistory();
  let navigatingHistory = false;
  let documentGeneration = 0;
  let writeQueue = Promise.resolve();
  if (stored?.typstMain) {
    session = applyOpenTypstDocument(session, stored.typstMain);
  } else if (stored?.root) {
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
    try {
      localStorage.setItem(
        PROJECT_STORAGE_KEY,
        serializeStoredSession({
          root: session.projectRoot,
          lastFile: session.path,
          carets,
          typstMain: session.typstMain,
        }),
      );
    } catch {
      // Persistence is best-effort; saving the document itself remains primary.
    }
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
      previous.projectRoot !== session.projectRoot ||
      previous.typstMain !== session.typstMain
    ) {
      for (const listener of sessionListeners) {
        listener();
      }
      fileWatch.follow(session.projectRoot !== null ? session.path : null);
      if (
        previous.projectRoot !== session.projectRoot ||
        previous.typstMain !== session.typstMain
      ) {
        syncTagIndex();
      } else {
        indexOpenFile();
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

  const writeTo = (path: string): Promise<boolean> => {
    const text = content.getText();
    const sourcePath = session.path;
    const sourceGeneration = documentGeneration;
    const queued = writeQueue.then(async (): Promise<boolean> => {
      try {
        await writeTextFile(path, text);
      } catch {
        await showError(`“${fileName(path)}” could not be saved.`);
        return false;
      }
      if (
        session.path === sourcePath &&
        documentGeneration === sourceGeneration
      ) {
        const previous = session;
        session = applySave(session, path, text);
        notify(previous);
      }
      return true;
    });
    writeQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
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

  const autosave = bindAutosave(async () => {
    if (session.projectRoot === null || session.path === null) {
      return;
    }
    if (!isDirty(session, content.getText())) {
      return;
    }
    await writeTo(session.path);
  }, AUTOSAVE_DELAY_MS);

  /**
   * Reloads the open file from disk when the buffer is clean and the file changed.
   */
  const applyExternalChange = async (): Promise<void> => {
    if (applying) {
      return;
    }
    if (session.projectRoot === null || session.path === null) {
      return;
    }
    const path = session.path;
    let disk: string;
    try {
      disk = await readDocumentText(path);
    } catch {
      return;
    }
    if (session.path !== path) {
      return;
    }
    if (!shouldApplyDiskText(content.getText(), session.lastSaved, disk)) {
      return;
    }
    const caret = content.getCaretOffset();
    const previous = session;
    session = applyOpen(session, path, disk);
    applying = true;
    content.setText(disk, undefined, true);
    content.setCaretOffset(clampCaretOffset(caret, disk.length));
    applying = false;
    notify(previous);
  };

  const fileWatch = bindOpenFileWatch(
    async (path, onEvent) => {
      if (!isTauriRuntime()) {
        return () => {};
      }
      const dir = dirname(path);
      if (dir === "") {
        return () => {};
      }
      try {
        return await watch(
          dir,
          (event) => {
            onEvent(event.paths);
          },
          { delayMs: OPEN_FILE_WATCH_DELAY_MS },
        );
      } catch {
        return () => {};
      }
    },
    () => {
      void applyExternalChange();
    },
  );

  const rememberVisit = (from: string | null, to: string | null): void => {
    if (navigatingHistory || from === to) {
      return;
    }
    history = recordVisit(history, from);
  };

  const adoptFile = async (
    path: string,
    caretLine?: number,
  ): Promise<boolean> => {
    let text: string;
    try {
      text = await readDocumentText(path);
    } catch (error) {
      if (!(error instanceof DocumentTooLargeError)) {
        const previous = session;
        session = applyForgetRecent(session, path);
        notify(previous);
      }
      const reason =
        error instanceof DocumentTooLargeError
          ? `“${fileName(path)}” is larger than 5 MB.`
          : `“${fileName(path)}” could not be opened.`;
      await showError(reason);
      return false;
    }
    const previous = session;
    documentGeneration += 1;
    session = applyOpen(session, path, text);
    applying = true;
    content.setText(text, caretLine, true);
    if (caretLine === undefined) {
      content.setCaretOffset(
        clampCaretOffset(caretFor(carets, path), text.length),
      );
    }
    applying = false;
    rememberVisit(previous.path, path);
    notify(previous);
    content.focus();
    content.revealCaret();
    return true;
  };

  const switchTo = async (
    path: string,
    caretLine?: number,
  ): Promise<boolean> => {
    await autosave.flush();
    if (session.path === path) {
      if (caretLine !== undefined) {
        content.setText(content.getText(), caretLine);
      }
      content.focus();
      return true;
    }
    if (!(await confirmProceed())) {
      return false;
    }
    return adoptFile(path, caretLine);
  };

  const goBack = async (): Promise<void> => {
    const hop = hopBack(history, session.path);
    if (hop === undefined) {
      return;
    }
    navigatingHistory = true;
    try {
      if (await switchTo(hop.path)) {
        history = hop.history;
      }
    } finally {
      navigatingHistory = false;
    }
  };

  const goForward = async (): Promise<void> => {
    const hop = hopForward(history, session.path);
    if (hop === undefined) {
      return;
    }
    navigatingHistory = true;
    try {
      if (await switchTo(hop.path)) {
        history = hop.history;
      }
    } finally {
      navigatingHistory = false;
    }
  };

  const newDocument = async (): Promise<void> => {
    await autosave.flush();
    if (!(await confirmProceed())) {
      return;
    }
    const previous = session;
    documentGeneration += 1;
    session = applyNew(session);
    applying = true;
    content.setText("", undefined, true);
    applying = false;
    rememberVisit(previous.path, null);
    notify(previous);
    content.focus();
  };

  const openDocument = async (): Promise<void> => {
    await autosave.flush();
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
      recursive: true,
    });
    if (typeof root !== "string") {
      return;
    }
    await autosave.flush();
    if (!(await confirmProceed())) {
      return;
    }
    const previous = session;
    session = applyOpenFolder(session, root);
    if (session.path !== null && !isUnderRoot(session.path, root)) {
      documentGeneration += 1;
      session = applyNew(session);
      applying = true;
      content.setText("", undefined, true);
      applying = false;
      rememberVisit(previous.path, null);
    }
    notify(previous);
    content.focus();
  };

  const openTypstDocument = async (): Promise<void> => {
    if (!isTauriRuntime()) {
      return;
    }
    const path = await open({
      multiple: false,
      directory: false,
      filters: TYPST_FILTERS,
    });
    if (typeof path !== "string") {
      return;
    }
    await autosave.flush();
    if (!(await confirmProceed())) {
      return;
    }
    const previous = session;
    session = applyOpenTypstDocument(session, path);
    notify(previous);
    await adoptFile(path, DOCUMENT_START_LINE);
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
        const dest = untitledCreatePath(
          session.projectRoot,
          typed,
          session.typstMain === null ? "note.md" : "note.typ",
        );
        if (dest === undefined) {
          return false;
        }
        if (await exists(dest)) {
          await showError(`“${fileName(dest)}” already exists.`);
          return false;
        }
        const saved = await writeTo(dest);
        if (saved) {
          await addIncludeToMain(dest);
        }
        return saved;
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
    await autosave.flush();
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
    if (!isSafeProjectRelative(relativePath)) {
      await showError("The selected file is outside the project.");
      return;
    }
    const dest = joinRoot(session.projectRoot, relativePath);
    if (!(await isContainedDestination(session.projectRoot, dest))) {
      await showError("The selected file is outside the project.");
      return;
    }
    if (session.typstMain !== null && !(await exists(dest))) {
      if (!(await ensureEmptyFile(dest))) {
        return;
      }
    }
    await switchTo(dest, caretLine ?? DOCUMENT_START_LINE);
  };

  const readRelativeNote = async (
    relative: string,
  ): Promise<string | undefined> => {
    if (session.projectRoot === null) {
      return undefined;
    }
    const abs = joinRoot(session.projectRoot, relative);
    if (
      !isSafeProjectRelative(relative) ||
      !(await isContainedDestination(session.projectRoot, abs))
    ) {
      return undefined;
    }
    if (session.path === abs) {
      return content.getText();
    }
    try {
      return await readDocumentText(abs);
    } catch {
      return undefined;
    }
  };

  const listTypstGraph = async (): Promise<string[]> => {
    if (session.projectRoot === null || session.typstMain === null) {
      return [];
    }
    const mainRelative = relativeFromRoot(session.projectRoot, session.typstMain);
    if (mainRelative === undefined) {
      return [];
    }
    return collectTypstProjectFiles(mainRelative, readRelativeNote);
  };

  const ensureEmptyFile = async (dest: string): Promise<boolean> => {
    if (await exists(dest)) {
      return true;
    }
    const parent = parentDir(dest);
    if (parent) {
      try {
        await mkdir(parent, { recursive: true });
      } catch {
        await showError(`“${fileName(dest)}” could not be created.`);
        return false;
      }
    }
    try {
      await writeTextFile(dest, "");
    } catch {
      await showError(`“${fileName(dest)}” could not be created.`);
      return false;
    }
    return true;
  };

  const addIncludeToMain = async (absoluteNewFile: string): Promise<void> => {
    const root = session.projectRoot;
    const main = session.typstMain;
    if (root === null || main === null || absoluteNewFile === main) {
      return;
    }
    const newRelative = relativeFromRoot(root, absoluteNewFile);
    const mainRelative = relativeFromRoot(root, main);
    if (newRelative === undefined || mainRelative === undefined) {
      return;
    }
    let text: string;
    try {
      text = await readDocumentText(main);
    } catch {
      return;
    }
    const next = appendTypstInclude(text, mainRelative, newRelative);
    if (next === text) {
      return;
    }
    try {
      await writeTextFile(main, next);
    } catch {
      await showError(`“${fileName(main)}” could not be saved.`);
    }
  };

  const listFiles = async (): Promise<string[]> => {
    if (session.projectRoot === null) {
      return [];
    }
    if (session.typstMain !== null) {
      return listTypstGraph();
    }
    return listProjectFiles(session.projectRoot);
  };

  const listAssets = async (): Promise<string[]> => {
    if (session.projectRoot === null) {
      return [];
    }
    return listProjectAssets(session.projectRoot);
  };

  const readNotes = async (): Promise<ProjectNote[]> => {
    if (session.projectRoot === null) {
      return [];
    }
    if (session.typstMain !== null) {
      const files = await listTypstGraph();
      const notes: ProjectNote[] = [];
      let charsRead = 0;
      for (const relative of files) {
        const note = await readRelativeNote(relative);
        if (note !== undefined) {
          charsRead += note.length;
          if (charsRead > MAX_TYPST_PROJECT_CHARS) {
            throw new Error("Typst project exceeds the content budget");
          }
          notes.push({ path: relative, content: note });
        }
      }
      return notes;
    }
    return readProjectNotes(session.projectRoot);
  };

  const search = async (query: string): Promise<SearchHit[]> => {
    if (session.projectRoot === null) {
      return [];
    }
    if (session.typstMain !== null) {
      const files = await listTypstGraph();
      const hits: SearchHit[] = [];
      let charsRead = 0;
      for (const relative of files) {
        if (hits.length >= SEARCH_LIMIT) {
          break;
        }
        const note = await readRelativeNote(relative);
        if (note === undefined) {
          continue;
        }
        charsRead += note.length;
        if (charsRead > MAX_TYPST_PROJECT_CHARS) {
          throw new Error("Typst project exceeds the content budget");
        }
        for (const hit of searchLines(note, query)) {
          if (hits.length >= SEARCH_LIMIT) {
            break;
          }
          hits.push({ path: relative, line: hit.line, text: hit.text });
        }
      }
      return hits;
    }
    return searchProject(session.projectRoot, query);
  };

  const tagIndex = bindProjectTagIndex({
    readNotes: async (root) => {
      if (session.typstMain !== null) {
        return readNotes();
      }
      return readProjectNotes(root);
    },
    readFile: async (path) => {
      try {
        return await readDocumentText(path);
      } catch {
        return null;
      }
    },
    startWatch: async (root, onEvent) => {
      if (!isTauriRuntime()) {
        return () => {};
      }
      try {
        return await watch(
          root,
          (event) => {
            onEvent(event.paths);
          },
          { delayMs: PROJECT_TAG_WATCH_DELAY_MS, recursive: true },
        );
      } catch {
        return () => {};
      }
    },
  });
  indexOpenFile = (): void => {
    if (session.projectRoot === null || session.path === null) {
      return;
    }
    const relative = relativeFromRoot(session.projectRoot, session.path);
    if (relative === undefined) {
      return;
    }
    tagIndex.setFile(relative, content.getText());
  };
  syncTagIndex = (): void => {
    if (session.projectRoot === null) {
      tagIndex.follow(null);
      return;
    }
    const root = session.projectRoot;
    if (session.typstMain !== null) {
      void listTypstGraph().then((files) => {
        if (session.projectRoot !== root || session.typstMain === null) {
          return;
        }
        tagIndex.follow(root, files);
        indexOpenFile();
      }).catch(() => undefined);
      return;
    }
    tagIndex.follow(root);
    indexOpenFile();
  };
  syncTagIndex();

  const followTypstInclude = async (includePath: string): Promise<void> => {
    if (session.projectRoot === null || session.path === null) {
      return;
    }
    const fromRelative = relativeFromRoot(session.projectRoot, session.path);
    if (fromRelative === undefined) {
      return;
    }
    const resolved = resolveTypstInclude(fromRelative, includePath);
    if (resolved === undefined) {
      return;
    }
    const dest = joinRoot(session.projectRoot, resolved);
    if (!(await isContainedDestination(session.projectRoot, dest))) {
      await showError("The include points outside the project.");
      return;
    }
    await autosave.flush();
    if (!(await ensureEmptyFile(dest))) {
      return;
    }
    await switchTo(dest);
  };

  const followWiki = async (target: string): Promise<void> => {
    if (session.projectRoot === null) {
      return;
    }
    await autosave.flush();
    const files = await listFiles();
    const assets = await listAssets();
    const relative = resolveWikiLink(target, files, assets);
    if (relative !== undefined) {
      const dest = joinRoot(session.projectRoot, relative);
      if (!(await isContainedDestination(session.projectRoot, dest))) {
        await showError("The wiki link points outside the project.");
        return;
      }
      if (!isNotePath(relative)) {
        try {
          await openLocalPath(dest);
        } catch {
          await showError(`“${fileName(dest)}” could not be opened.`);
        }
        return;
      }
      await switchTo(dest);
      return;
    }
    if (isWikiAssetTarget(target)) {
      await showError(`“${fileName(target)}” could not be opened.`);
      return;
    }
    const dest = wikiCreatePath(target, session.projectRoot, session.path);
    if (dest === undefined) {
      await showError("The wiki link points outside the project.");
      return;
    }
    if (!(await isContainedDestination(session.projectRoot, dest))) {
      await showError("The wiki link points outside the project.");
      return;
    }
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
    await switchTo(dest);
  };

  const stopChange = content.onChange(() => {
    if (applying) {
      return;
    }
    indexOpenFile();
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
        await caretPersist.flush();
        persistSession();
        await autosave.flush();
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
    openTypstDocument,
    save: saveDocument,
    saveAs: () => saveAsDocument(),
    rename: renameDocument,
    openRecent,
    openProjectFile,
    followWiki,
    followTypstInclude,
    listFiles,
    listAssets,
    readNotes,
    search,
    tagsFor: (relativePath) => tagIndex.tagsFor(relativePath),
    path: () => session.path,
    projectRoot: () => session.projectRoot,
    typstMain: () => session.typstMain,
    recents: () => session.recents,
    goBack,
    goForward,
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
      caretPersist.cancel();
      persistSession();
      autosave.cancel();
      fileWatch.disconnect();
      tagIndex.disconnect();
      stopChange();
      stopCaret();
      unlistenClose?.();
      recentsListeners.clear();
      sessionListeners.clear();
    },
  };
}
