/**
 * Opens a local file in the system default application.
 */
export async function openLocalPath(path: string): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(path);
  }
}
