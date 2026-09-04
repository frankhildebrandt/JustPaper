import { forgetRecent, rememberRecent } from "./recentFiles";

export type DocumentSession = {
  path: string | null;
  lastSaved: string;
  recents: string[];
  projectRoot: string | null;
  typstMain: string | null;
};

/**
 * Starts an untitled session, optionally restoring recent files.
 */
export function createDocumentSession(recents: string[] = []): DocumentSession {
  return { path: null, lastSaved: "", recents, projectRoot: null, typstMain: null };
}

/**
 * Returns whether the editor text differs from the last saved snapshot.
 */
export function isDirty(session: DocumentSession, currentText: string): boolean {
  return currentText !== session.lastSaved;
}

/**
 * Returns whether an external disk snapshot should replace the editor.
 * Skips when the buffer is already in sync or still has unsaved edits.
 */
export function shouldApplyDiskText(
  editorText: string,
  lastSaved: string,
  diskText: string,
): boolean {
  return diskText !== editorText && editorText === lastSaved;
}

/**
 * Returns an untitled session that keeps recents and the project root.
 */
export function applyNew(session: DocumentSession): DocumentSession {
  return {
    path: null,
    lastSaved: "",
    recents: session.recents,
    projectRoot: session.projectRoot,
    typstMain: session.typstMain,
  };
}

/**
 * Adopts an opened file as the current document and remembers its path.
 */
export function applyOpen(
  session: DocumentSession,
  path: string,
  content: string,
): DocumentSession {
  return {
    path,
    lastSaved: content,
    recents: rememberRecent(session.recents, path),
    projectRoot: session.projectRoot,
    typstMain: session.typstMain,
  };
}

/**
 * Records a successful save, including Save As to a new path.
 */
export function applySave(
  session: DocumentSession,
  path: string,
  content: string,
): DocumentSession {
  return applyOpen(session, path, content);
}

/**
 * Removes a path from recents, leaving the current document unchanged.
 */
export function applyForgetRecent(
  session: DocumentSession,
  path: string,
): DocumentSession {
  return { ...session, recents: forgetRecent(session.recents, path) };
}

/**
 * Enters project mode with the given root folder.
 */
export function applyOpenFolder(
  session: DocumentSession,
  projectRoot: string,
): DocumentSession {
  return { ...session, projectRoot, typstMain: null };
}

/**
 * Enters a Typst project whose file set is the main document's `#include` graph.
 */
export function applyOpenTypstDocument(
  session: DocumentSession,
  mainPath: string,
): DocumentSession {
  return {
    ...session,
    projectRoot: parentDir(mainPath),
    typstMain: mainPath,
  };
}

/**
 * Records an on-disk rename of the open document.
 */
export function applyRename(
  session: DocumentSession,
  path: string,
): DocumentSession {
  const recents = session.path
    ? rememberRecent(forgetRecent(session.recents, session.path), path)
    : rememberRecent(session.recents, path);
  const typstMain = session.typstMain === session.path ? path : session.typstMain;
  return { ...session, path, recents, typstMain };
}

function parentDir(path: string): string {
  const trimmed = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) {
    return slash === 0 ? "/" : "";
  }
  return trimmed.slice(0, slash);
}
