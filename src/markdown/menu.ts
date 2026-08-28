import {
  CheckMenuItem,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu";
import type { MarkdownFeature, MarkdownFeatures } from "./features";

export const MARKDOWN_FEATURE_LABELS: ReadonlyArray<{
  id: MarkdownFeature;
  text: string;
}> = [
  { id: "heading", text: "Überschrift" },
  { id: "strong", text: "Fett" },
  { id: "em", text: "Kursiv" },
  { id: "inlineCode", text: "Inline-Code" },
  { id: "wiki", text: "Wiki-Link" },
  { id: "table", text: "Tabelle" },
  { id: "blockquote", text: "Zitat" },
  { id: "codeblock", text: "Codeblock" },
  { id: "image", text: "Bild" },
  { id: "externalImage", text: "Externe Bilder" },
  { id: "externalLink", text: "Externer Link" },
  { id: "frontmatter", text: "Frontmatter" },
  { id: "todo", text: "Todos" },
];

const SEPARATOR_BEFORE: MarkdownFeature = "table";

/**
 * Builds checkable Markdown-feature menu items and a lookup by feature id.
 */
export async function markdownFeatureMenuItems(
  features: MarkdownFeatures,
  onToggle: (id: MarkdownFeature) => void,
): Promise<{
  items: Array<CheckMenuItem | Awaited<ReturnType<typeof PredefinedMenuItem.new>>>;
  byId: Record<MarkdownFeature, CheckMenuItem>;
}> {
  const byId = {} as Record<MarkdownFeature, CheckMenuItem>;
  const items: Array<
    CheckMenuItem | Awaited<ReturnType<typeof PredefinedMenuItem.new>>
  > = [];

  for (const { id, text } of MARKDOWN_FEATURE_LABELS) {
    if (id === SEPARATOR_BEFORE) {
      items.push(await PredefinedMenuItem.new({ item: "Separator" }));
    }
    const item = await CheckMenuItem.new({
      id: `markdown-${id}`,
      text,
      checked: features[id],
      action: () => {
        onToggle(id);
      },
    });
    byId[id] = item;
    items.push(item);
  }

  return { items, byId };
}
