export type MarkdownFeature =
  | "heading"
  | "strong"
  | "em"
  | "inlineCode"
  | "wiki"
  | "table"
  | "blockquote"
  | "codeblock"
  | "image"
  | "externalImage"
  | "externalLink"
  | "frontmatter"
  | "todo";

export type MarkdownFeatures = Record<MarkdownFeature, boolean>;

export const MARKDOWN_FEATURES: readonly MarkdownFeature[] = [
  "heading",
  "strong",
  "em",
  "inlineCode",
  "wiki",
  "table",
  "blockquote",
  "codeblock",
  "image",
  "externalImage",
  "externalLink",
  "frontmatter",
  "todo",
];

export const DEFAULT_MARKDOWN_FEATURES: MarkdownFeatures = {
  heading: true,
  strong: true,
  em: true,
  inlineCode: true,
  wiki: true,
  table: true,
  blockquote: true,
  codeblock: true,
  image: true,
  externalImage: false,
  externalLink: true,
  frontmatter: true,
  todo: true,
};

/**
 * Returns which markdown-feature menu items should be checked.
 */
export function checkedMarkdownFeatureItems(
  features: MarkdownFeatures,
): MarkdownFeatures {
  return { ...features };
}

/**
 * Returns a copy of `features` with one flag set.
 */
export function withMarkdownFeature(
  features: MarkdownFeatures,
  id: MarkdownFeature,
  enabled: boolean,
): MarkdownFeatures {
  return { ...features, [id]: enabled };
}
