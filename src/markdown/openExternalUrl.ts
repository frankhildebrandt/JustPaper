/**
 * Opens an http(s) URL in the system browser.
 */
export async function openExternalUrl(href: string): Promise<void> {
  if (!href.startsWith("https://") && !href.startsWith("http://")) {
    return;
  }
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(href);
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}
