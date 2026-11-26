import type { Text } from "@codemirror/state";
import type { TypstFeatures } from "../typst/features";
import { parseTypst, type Block as TypstBlock } from "../typst/parse";
import type { MarkdownFeatures } from "./features";
import { parseMarkdown, type Block } from "./parse";

type Parsed<F, B> = { features: F; blocks: B[] };

const sources = new WeakMap<Text, string>();
const markdownCache = new WeakMap<Text, Parsed<MarkdownFeatures, Block>>();
const typstCache = new WeakMap<Text, Parsed<TypstFeatures, TypstBlock>>();

/**
 * Returns the document text, flattened once per immutable document version.
 */
export function docSource(doc: Text): string {
  let source = sources.get(doc);
  if (source === undefined) {
    source = doc.toString();
    sources.set(doc, source);
  }
  return source;
}

/**
 * Returns the markdown blocks of `doc`, parsed once per document version and
 * feature set so decorations, atomic ranges and key handlers share one parse.
 */
export function markdownBlocks(doc: Text, features: MarkdownFeatures): Block[] {
  return cached(markdownCache, doc, features, parseMarkdown);
}

/**
 * Returns the Typst blocks of `doc`, parsed once per document version and feature set.
 */
export function typstBlocks(doc: Text, features: TypstFeatures): TypstBlock[] {
  return cached(typstCache, doc, features, parseTypst);
}

function cached<F, B>(
  cache: WeakMap<Text, Parsed<F, B>>,
  doc: Text,
  features: F,
  parse: (source: string, features: F) => B[],
): B[] {
  const hit = cache.get(doc);
  if (hit && hit.features === features) {
    return hit.blocks;
  }
  const blocks = parse(docSource(doc), features);
  cache.set(doc, { features, blocks });
  return blocks;
}
