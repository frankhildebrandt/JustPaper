import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  Compartment,
  EditorState,
  Prec,
  StateEffect,
  StateField,
  type Range,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import { addAtxHash, removeAtxHash, type AtxEdit } from "./atxEdit";
import { decorationSpecs, headingPrefixRanges, type DecorationSpec } from "./decorationSpecs";
import { applyHeadingCssVars } from "./headingStyle";
import { parseMarkdown } from "./parse";
import { offsetAtLine } from "../caret";
import type { HighlightMode } from "../highlightMode";
import { dimRanges } from "../highlightRange";
import { revealCaretLine, type TypewriterTarget } from "../typewriter";
import { wikiLinkAt } from "../wikiLink";

const setShowMarks = StateEffect.define<boolean>();
const setHighlightModeEffect = StateEffect.define<HighlightMode>();

const showMarksField = StateField.define<boolean>({
  create: () => true,
  update(value, transaction): boolean {
    for (const effect of transaction.effects) {
      if (effect.is(setShowMarks)) {
        return effect.value;
      }
    }
    return value;
  },
});

const markdownDecorations = StateField.define<DecorationSet>({
  create(state): DecorationSet {
    return decorationsFor(state.doc.toString(), state.field(showMarksField));
  },
  update(current, transaction): DecorationSet {
    const showMarks = transaction.state.field(showMarksField);
    if (
      transaction.docChanged ||
      transaction.effects.some((effect) => effect.is(setShowMarks))
    ) {
      return decorationsFor(transaction.state.doc.toString(), showMarks);
    }
    return current.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const highlightModeField = StateField.define<HighlightMode>({
  create: () => "none",
  update(value, transaction): HighlightMode {
    for (const effect of transaction.effects) {
      if (effect.is(setHighlightModeEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

const highlightDecorations = StateField.define<DecorationSet>({
  create(state): DecorationSet {
    return decorationsForHighlight(state);
  },
  update(current, transaction): DecorationSet {
    if (
      transaction.docChanged ||
      transaction.selection ||
      transaction.effects.some((effect) => effect.is(setHighlightModeEffect))
    ) {
      return decorationsForHighlight(transaction.state);
    }
    return current.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const paperTheme = EditorView.theme({
  "&": {
    height: "100%",
    background: "transparent",
    color: "var(--ink)",
    fontFamily: '"Courier Prime", ui-monospace, "Courier New", monospace',
    fontSize: "inherit",
    lineHeight: "inherit",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    height: "100%",
    overflowX: "hidden",
    overflowY: "auto",
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
    paddingInline: "var(--margin-x)",
  },
  ".cm-content": {
    padding: "0",
    caretColor: "var(--ink)",
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
    whiteSpace: "pre-wrap",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-line.md-h1": {
    position: "relative",
    fontSize: "var(--md-h1-font)",
    fontWeight: "700",
    lineHeight: "var(--md-h1-line)",
    paddingTop: "var(--md-h1-before)",
    paddingBottom: "var(--md-h1-after)",
  },
  ".cm-line.md-h2": {
    position: "relative",
    fontSize: "var(--md-h2-font)",
    fontWeight: "700",
    lineHeight: "var(--md-h2-line)",
    paddingTop: "var(--md-h2-before)",
    paddingBottom: "var(--md-h2-after)",
  },
  ".cm-line.md-h3": {
    position: "relative",
    fontSize: "var(--md-h3-font)",
    fontWeight: "700",
    lineHeight: "var(--md-h3-line)",
    paddingTop: "var(--md-h3-before)",
    paddingBottom: "var(--md-h3-after)",
  },
  ".cm-line.md-h4": {
    position: "relative",
    fontSize: "var(--md-h4-font)",
    fontWeight: "700",
    lineHeight: "var(--md-h4-line)",
    paddingTop: "var(--md-h4-before)",
    paddingBottom: "var(--md-h4-after)",
  },
  ".cm-line.md-h5": {
    position: "relative",
    fontSize: "var(--md-h5-font)",
    fontWeight: "700",
    lineHeight: "var(--md-h5-line)",
    paddingTop: "var(--md-h5-before)",
    paddingBottom: "var(--md-h5-after)",
  },
  ".cm-line.md-h6": {
    position: "relative",
    fontSize: "var(--md-h6-font)",
    fontWeight: "700",
    lineHeight: "var(--md-h6-line)",
    paddingTop: "var(--md-h6-before)",
    paddingBottom: "var(--md-h6-after)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--ink)",
  },
  "&.cm-focused .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  ".cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
});

export type MarkdownSurface = "markdownEdit" | "markdownView";

export type MarkdownEditor = {
  getDocument: () => string;
  setDocument: (text: string, caretLine?: number) => void;
  getCaretOffset: () => number;
  setCaretOffset: (offset: number) => void;
  revealCaret: () => void;
  setSurface: (surface: MarkdownSurface) => void;
  setHighlightMode: (mode: HighlightMode) => void;
  layoutElement: HTMLElement;
  typewriterTarget: TypewriterTarget;
  onChange: (listener: () => void) => () => void;
  setWikiFollow: (handler: ((target: string) => void) | undefined) => void;
  focus: () => void;
  destroy: () => void;
};

/**
 * Mounts a CodeMirror editor that styles markdown from our parser.
 */
export function bindMarkdownEditor(parent: HTMLElement): MarkdownEditor {
  applyHeadingCssVars(parent);
  const editable = new Compartment();
  const caretListeners = new Set<() => void>();
  const changeListeners = new Set<() => void>();
  let wikiFollow: ((target: string) => void) | undefined;

  const followWikiAt = (source: string, offset: number): boolean => {
    const link = wikiLinkAt(source, offset);
    if (!link || !wikiFollow) {
      return false;
    }
    wikiFollow(link.target);
    return true;
  };

  const view = new EditorView({
    parent,
    state: EditorState.create({
      extensions: [
        showMarksField,
        markdownDecorations,
        highlightModeField,
        highlightDecorations,
        headingPrefixAtoms(),
        atxKeymap(),
        history(),
        keymap.of([
          {
            key: "Mod-Enter",
            run: (current) =>
              followWikiAt(
                current.state.doc.toString(),
                current.state.selection.main.head,
              ),
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        drawSelection(),
        EditorView.lineWrapping,
        EditorState.tabSize.of(4),
        EditorView.contentAttributes.of({ spellcheck: "false" }),
        editable.of(EditorView.editable.of(true)),
        paperTheme,
        EditorView.domEventHandlers({
          click: (event, current) => {
            if (!event.metaKey && !event.ctrlKey) {
              return false;
            }
            const pos = current.posAtCoords({
              x: event.clientX,
              y: event.clientY,
            });
            if (pos === null) {
              return false;
            }
            return followWikiAt(current.state.doc.toString(), pos);
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            for (const listener of changeListeners) {
              listener();
            }
          }
          if (update.docChanged || update.selectionSet) {
            for (const listener of caretListeners) {
              listener();
            }
          }
        }),
      ],
    }),
  });

  const typewriterTarget: TypewriterTarget = {
    scrollElement: view.scrollDOM,
    isFocused: () => view.hasFocus,
    measureCaretTopPx: () => measureMarkdownCaretTopPx(view),
    onCaretMoved: (handler: () => void): (() => void) => {
      caretListeners.add(handler);
      return () => {
        caretListeners.delete(handler);
      };
    },
  };

  return {
    getDocument: () => view.state.doc.toString(),
    setDocument: (text: string, caretLine?: number): void => {
      const caret =
        caretLine === undefined
          ? undefined
          : offsetAtLine(text, caretLine);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection:
          caret === undefined
            ? undefined
            : { anchor: Math.min(caret, text.length) },
      });
    },
    getCaretOffset: () => view.state.selection.main.head,
    setCaretOffset: (offset: number): void => {
      const caret = Math.min(Math.max(offset, 0), view.state.doc.length);
      view.dispatch({ selection: { anchor: caret } });
    },
    revealCaret: (): void => {
      revealCaretLine(view.scrollDOM, measureMarkdownCaretTopPx(view));
    },
    setSurface: (surface: MarkdownSurface): void => {
      const showMarks = surface === "markdownEdit";
      view.dispatch({
        effects: [
          editable.reconfigure(EditorView.editable.of(showMarks)),
          setShowMarks.of(showMarks),
        ],
      });
    },
    setHighlightMode: (mode: HighlightMode): void => {
      view.dispatch({ effects: setHighlightModeEffect.of(mode) });
    },
    layoutElement: view.scrollDOM,
    typewriterTarget,
    onChange: (listener: () => void): (() => void) => {
      changeListeners.add(listener);
      return () => {
        changeListeners.delete(listener);
      };
    },
    setWikiFollow: (handler): void => {
      wikiFollow = handler;
    },
    focus: () => {
      view.focus();
    },
    destroy: () => {
      caretListeners.clear();
      changeListeners.clear();
      view.destroy();
    },
  };
}

function headingPrefixAtoms() {
  return EditorView.atomicRanges.of((view) => {
    const prefixes = headingPrefixRanges(parseMarkdown(view.state.doc.toString()));
    return Decoration.set(
      prefixes
        .filter((range) => range.to > range.from)
        .map((range) => Decoration.mark({}).range(range.from, range.to)),
      true,
    );
  });
}

function atxKeymap() {
  return Prec.high(
    keymap.of([
      {
        key: "#",
        run: (view) => applyAtxEdit(view, (doc, pos) => addAtxHash(doc, pos)),
      },
      {
        key: "Backspace",
        run: (view) => applyAtxEdit(view, (doc, pos) => removeAtxHash(doc, pos)),
      },
    ]),
  );
}

function applyAtxEdit(
  view: EditorView,
  edit: (doc: string, pos: number) => AtxEdit | undefined,
): boolean {
  if (!view.state.facet(EditorView.editable)) {
    return false;
  }
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return false;
  }
  const next = edit(view.state.doc.toString(), selection.head);
  if (!next) {
    return false;
  }
  view.dispatch({
    changes: { from: next.from, to: next.to, insert: next.insert },
    selection: { anchor: next.caret },
  });
  return true;
}

function decorationsForHighlight(state: EditorState): DecorationSet {
  const ranges = dimRanges(
    state.doc.toString(),
    state.selection.main.head,
    state.field(highlightModeField),
  );
  const mark = Decoration.mark({ class: "highlight-dim" });
  return Decoration.set(
    ranges
      .filter((range) => range.to > range.from)
      .map((range) => mark.range(range.from, range.to)),
    true,
  );
}

function decorationsFor(source: string, showMarks: boolean): DecorationSet {
  const specs = decorationSpecs(parseMarkdown(source), { showMarks });
  return Decoration.set(specs.flatMap(specToRanges), true);
}

function specToRanges(spec: DecorationSpec): Range<Decoration>[] {
  if (spec.kind.startsWith("line-h")) {
    const className = `md-h${spec.kind.slice("line-h".length)}`;
    return [Decoration.line({ class: className }).range(spec.from)];
  }
  if (spec.from >= spec.to) {
    return [];
  }
  if (spec.kind === "hide") {
    return [Decoration.replace({}).range(spec.from, spec.to)];
  }
  if (spec.kind === "atx") {
    return [Decoration.mark({ class: "md-atx" }).range(spec.from, spec.to)];
  }
  if (spec.kind === "mark") {
    return [Decoration.mark({ class: "md-mark" }).range(spec.from, spec.to)];
  }
  return [
    Decoration.mark({ class: `md-${spec.kind}` }).range(spec.from, spec.to),
  ];
}

/**
 * Measures the caret line's Y offset inside the CodeMirror scroller.
 */
function measureMarkdownCaretTopPx(view: EditorView): number {
  const coords = view.coordsAtPos(view.state.selection.main.head);
  if (!coords) {
    return parseFloat(getComputedStyle(view.scrollDOM).paddingTop) || 0;
  }
  const scroller = view.scrollDOM.getBoundingClientRect();
  return coords.top - scroller.top + view.scrollDOM.scrollTop;
}
