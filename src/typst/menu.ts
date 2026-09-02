import {
  CheckMenuItem,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu";
import type { TypstFeature, TypstFeatures } from "./features";

export const TYPST_FEATURE_LABELS: ReadonlyArray<{
  id: TypstFeature;
  text: string;
}> = [
  { id: "heading", text: "Überschrift" },
  { id: "strong", text: "Fett" },
  { id: "em", text: "Kursiv" },
  { id: "inlineCode", text: "Inline-Code" },
  { id: "math", text: "Formel" },
  { id: "link", text: "Link" },
  { id: "label", text: "Label" },
  { id: "ref", text: "Referenz" },
  { id: "list", text: "Liste" },
  { id: "codeblock", text: "Codeblock" },
  { id: "hash", text: "Code-Ausdruck" },
  { id: "comment", text: "Kommentar" },
  { id: "linebreak", text: "Zeilenumbruch" },
  { id: "smartquote", text: "Anführungszeichen" },
  { id: "symbols", text: "Symbole" },
];

const SEPARATOR_BEFORE: TypstFeature = "list";

/**
 * Builds checkable Typst-feature menu items and a lookup by feature id.
 */
export async function typstFeatureMenuItems(
  features: TypstFeatures,
  onToggle: (id: TypstFeature) => void,
): Promise<{
  items: Array<CheckMenuItem | Awaited<ReturnType<typeof PredefinedMenuItem.new>>>;
  byId: Record<TypstFeature, CheckMenuItem>;
}> {
  const byId = {} as Record<TypstFeature, CheckMenuItem>;
  const items: Array<
    CheckMenuItem | Awaited<ReturnType<typeof PredefinedMenuItem.new>>
  > = [];

  for (const { id, text } of TYPST_FEATURE_LABELS) {
    if (id === SEPARATOR_BEFORE) {
      items.push(await PredefinedMenuItem.new({ item: "Separator" }));
    }
    const item = await CheckMenuItem.new({
      id: `typst-${id}`,
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
