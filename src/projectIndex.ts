import { invoke } from "@tauri-apps/api/core";

export type SearchHit = {
  path: string;
  line: number;
  text: string;
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
