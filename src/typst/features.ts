export type TypstFeature =
  | "heading"
  | "strong"
  | "em"
  | "inlineCode"
  | "math"
  | "link"
  | "label"
  | "ref"
  | "list"
  | "codeblock"
  | "hash"
  | "comment"
  | "linebreak"
  | "smartquote"
  | "symbols";

export type TypstFeatures = Record<TypstFeature, boolean>;

export const TYPST_FEATURES: readonly TypstFeature[] = [
  "heading",
  "strong",
  "em",
  "inlineCode",
  "math",
  "link",
  "label",
  "ref",
  "list",
  "codeblock",
  "hash",
  "comment",
  "linebreak",
  "smartquote",
  "symbols",
];

export const DEFAULT_TYPST_FEATURES: TypstFeatures = {
  heading: true,
  strong: true,
  em: true,
  inlineCode: true,
  math: true,
  link: true,
  label: true,
  ref: true,
  list: true,
  codeblock: true,
  hash: true,
  comment: true,
  linebreak: true,
  smartquote: true,
  symbols: true,
};

/**
 * Returns which typst-feature menu items should be checked.
 */
export function checkedTypstFeatureItems(
  features: TypstFeatures,
): TypstFeatures {
  return { ...features };
}

/**
 * Returns a copy of `features` with one flag set.
 */
export function withTypstFeature(
  features: TypstFeatures,
  id: TypstFeature,
  enabled: boolean,
): TypstFeatures {
  return { ...features, [id]: enabled };
}
