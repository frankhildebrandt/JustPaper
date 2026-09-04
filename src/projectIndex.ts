import { invoke } from "@tauri-apps/api/core";

export type SearchHit = {
  path: string;
  line: number;
  text: string;
};

export type ProjectNote = {
  path: string;
  content: string;
};

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Lists project-relative `.md` and `.txt` paths under `root`.
 */
export async function listProjectFiles(root: string): Promise<string[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<string[]>("list_project_files", { root });
}

/**
 * Lists project-relative non-note files under `root`, such as PDFs.
 */
export async function listProjectAssets(root: string): Promise<string[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<string[]>("list_project_assets", { root });
}

/**
 * Searches file contents under `root` and returns line hits.
 */
export async function searchProject(
  root: string,
  query: string,
): Promise<SearchHit[]> {
  if (!isTauriRuntime() || query.trim().length === 0) {
    return [];
  }
  return invoke<SearchHit[]>("search_project", { root, query });
}

/**
 * Reads note contents under `root`.
 */
export async function readProjectNotes(root: string): Promise<ProjectNote[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<ProjectNote[]>("read_project_notes", { root });
}
