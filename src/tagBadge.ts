/**
 * Replaces `host` children with a badge for each tag.
 */
export function renderTagBadges(
  host: HTMLElement,
  tags: readonly string[],
): void {
  host.replaceChildren();
  host.hidden = tags.length === 0;
  for (const tag of tags) {
    const badge = document.createElement("span");
    badge.className = "tag-badge";
    badge.textContent = tag;
    host.append(badge);
  }
}
