import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  StateEffect,
  StateField,
  type SelectionRange,
  type Range,
} from "@codemirror/state";
import {
  Decoration,
  Direction,
  EditorView,
  drawSelection,
  keymap,
  type DecorationSet,
  type MouseSelectionStyle,
  type ViewUpdate,
} from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import { addAtxHash, removeAtxHash, type AtxEdit } from "./atxEdit";
import { decorationSpecs, decorationRevealKey, atomicSyntaxRanges, type DecorationSpec } from "./decorationSpecs";
import { applyHeadingCssVars } from "./headingStyle";
import type { Block } from "./parse";
import { docSource, markdownBlocks, typstBlocks } from "./parsedDoc";
import {
  loadDocument,
  replaceDocumentWithFreshHistory,
} from "./documentLoad";
import { goalColumnField } from "./goalColumn";
import { caretMoveSpec, logicalDirection } from "./caretMove";
import { onGestureEnd } from "./pointerGestureEnd";
import { todoToggleOnLine } from "./todoToggle";
import {
  GlyphWidget,
  ImageWidget,
  LinebreakWidget,
  TodoWidget,
} from "./inlineWidgets";
import {
  typstAtomicSyntaxRanges,
  typstDecorationRevealKey,
  typstDecorationSpecs,
} from "../typst/decorationSpecs";
import {
  addHeadingMark,
  removeHeadingMark,
  type HeadingEdit,
} from "../typst/headingEdit";
import { typstIncludeAt } from "../typst/includes";
import { typstLinkAt } from "../typst/parse";
import { CodeWidget, HrWidget, QuoteWidget, TableWidget } from "./graphicWidgets";
import {
  caretRevealsTable,
  caretSkippedGraphic,
  enterGraphicAcross,
  enterGraphicAlong,
  type GraphicSpan,
} from "./graphicNav";
import { graphicWidgetFromDomPos } from "./graphicWidgetDom";
import { nativeCaretFromPoint } from "./caretPoint";
import {
  bestPosOnLineByCoords,
  clickPosMatchesPoint,
  domPosFromGlyphPoint,
  enterClientPoint,
  isVisualLineStep,
  sourcePosFromCodeClick,
  sourcePosFromTablePoint,
  visualLineProbeY,
} from "./visualPos";
import {
  DEFAULT_MARKDOWN_FEATURES,
  type MarkdownFeatures,
} from "./features";
import {
  DEFAULT_TYPST_FEATURES,
  type TypstFeatures,
} from "../typst/features";
import { offsetAtLine } from "../caret";
import type { HighlightMode } from "../highlightMode";
import { dimRanges } from "../highlightRange";
import { revealCaretLine, type TypewriterTarget } from "../typewriter";
import { wikiLinkAt } from "../wikiLink";
import { externalLinkAt } from "./parseLink";
import { openExternalUrl } from "./openExternalUrl";
import { resolveImageSrc } from "./imageSrc";
import { allowCaretReveal, selectionLockHolds } from "./revealTiming";
import {
  pointerRangeAt,
  spanPointerRanges,
  visualRowRangeAt,
  type VisualRowHit,
} from "./pointerSelection";

export type PaperLanguage = "markdown" | "typst";
export type PaperSurface = "edit" | "view";
const setShowMarks = StateEffect.define<boolean>();
const setHighlightModeEffect = StateEffect.define<HighlightMode>();
const setFeaturesEffect = StateEffect.define<MarkdownFeatures>();
const setTypstFeaturesEffect = StateEffect.define<TypstFeatures>();
/**
 * Folders that relative and project-absolute (`/…`) asset paths resolve against.
 */
type AssetBase = { dir: string | null; projectRoot: string | null };

const NO_ASSET_BASE: AssetBase = { dir: null, projectRoot: null };
const setAssetBaseEffect = StateEffect.define<AssetBase>();
const setGraphicEffect = StateEffect.define<boolean>();
const setLanguageEffect = StateEffect.define<PaperLanguage>();
const setPointerSelecting = StateEffect.define<boolean>();

type PointerPoint = { pos: number; bias: number };
const recentPointerClicks = new WeakMap<EditorView, PointerPoint>();

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

const pointerSelectingField = StateField.define<boolean>({
  create: () => false,
  update(value, transaction): boolean {
    for (const effect of transaction.effects) {
      if (effect.is(setPointerSelecting)) {
        return effect.value;
      }
    }
    return value;
  },
});

const featuresField = StateField.define<MarkdownFeatures>({
  create: () => DEFAULT_MARKDOWN_FEATURES,
  update(value, transaction): MarkdownFeatures {
    for (const effect of transaction.effects) {
      if (effect.is(setFeaturesEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

const typstFeaturesField = StateField.define<TypstFeatures>({
  create: () => DEFAULT_TYPST_FEATURES,
  update(value, transaction): TypstFeatures {
    for (const effect of transaction.effects) {
      if (effect.is(setTypstFeaturesEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

const assetBaseField = StateField.define<AssetBase>({
  create: () => NO_ASSET_BASE,
  update(value, transaction): AssetBase {
    for (const effect of transaction.effects) {
      if (effect.is(setAssetBaseEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

const graphicField = StateField.define<boolean>({
  create: () => false,
  update(value, transaction): boolean {
    for (const effect of transaction.effects) {
      if (effect.is(setGraphicEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

const languageField = StateField.define<PaperLanguage>({
  create: () => "markdown",
  update(value, transaction): PaperLanguage {
    for (const effect of transaction.effects) {
      if (effect.is(setLanguageEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

const markdownDecorations = StateField.define<DecorationSet>({
  create(state): DecorationSet {
    return decorationsFor(state);
  },
  update(current, transaction): DecorationSet {
    const state = transaction.state;
    if (
      transaction.docChanged ||
      transaction.effects.some(
        (effect) =>
          effect.is(setShowMarks) ||
          effect.is(setFeaturesEffect) ||
          effect.is(setTypstFeaturesEffect) ||
          effect.is(setAssetBaseEffect) ||
          effect.is(setGraphicEffect) ||
          effect.is(setLanguageEffect),
      )
    ) {
      return decorationsFor(state);
    }
    const pointerSelectingEnded = transaction.effects.some(
      (effect) => effect.is(setPointerSelecting) && effect.value === false,
    );
    if (pointerSelectingEnded) {
      return decorationsFor(state);
    }
    if (
      allowCaretReveal(
        state.field(showMarksField),
        state.field(pointerSelectingField),
      ) &&
      transaction.selection &&
      revealKey(state, state.selection.main.head) !==
        revealKey(state, transaction.startState.selection.main.head)
    ) {
      return decorationsFor(state);
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
    caretColor: "var(--accent)",
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
    borderLeft: "3.5px solid var(--accent)",
  },
  "&.cm-focused > .cm-scroller > .cm-cursorLayer": {
    animationTimingFunction: "ease-in-out",
  },
  "@keyframes cm-blink": {
    "0%": { opacity: "1" },
    "50%": { opacity: "0.28" },
    "100%": { opacity: "1" },
  },
  "@keyframes cm-blink2": {
    "0%": { opacity: "1" },
    "50%": { opacity: "0.28" },
    "100%": { opacity: "1" },
  },
  "&.cm-focused .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  ".cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent) 22%, transparent)",
  },
});

export type MarkdownSurface = PaperSurface;

export type CaretScreenBox = {
  left: number;
  bottom: number;
};

export type MarkdownEditor = {
  getDocument: () => string;
  setDocument: (text: string, caretLine?: number, resetUndo?: boolean) => void;
  getCaretOffset: () => number;
  setCaretOffset: (offset: number) => void;
  isSelectionEmpty: () => boolean;
  caretScreenBox: () => CaretScreenBox | null;
  replaceRange: (from: number, to: number, text: string) => void;
  offsetAtClientPoint: (clientX: number, clientY: number) => number | undefined;
  revealCaret: () => void;
  setSurface: (surface: PaperSurface) => void;
  setLanguage: (language: PaperLanguage) => void;
  setHighlightMode: (mode: HighlightMode) => void;
  setFeatures: (features: MarkdownFeatures) => void;
  setTypstFeatures: (features: TypstFeatures) => void;
  setAssetBase: (dir: string | null, projectRoot?: string | null) => void;
  setGraphic: (enabled: boolean) => void;
  setLinkHelperKeys: (handler: ((key: string) => boolean) | undefined) => void;
  layoutElement: HTMLElement;
  typewriterTarget: TypewriterTarget;
  onChange: (listener: () => void) => () => void;
  setWikiFollow: (handler: ((target: string) => void) | undefined) => void;
  setIncludeFollow: (handler: ((target: string) => void) | undefined) => void;
  focus: () => void;
  destroy: () => void;
};

/**
 * Mounts a CodeMirror editor that styles markdown from our parser.
 */
export function bindMarkdownEditor(parent: HTMLElement): MarkdownEditor {
  applyHeadingCssVars(parent);
  const editable = new Compartment();
  const undoHistory = new Compartment();
  const caretListeners = new Set<() => void>();
  const changeListeners = new Set<() => void>();
  let wikiFollow: ((target: string) => void) | undefined;
  let includeFollow: ((target: string) => void) | undefined;
  let linkHelperKeys: ((key: string) => boolean) | undefined;

  const followAt = (current: EditorView, offset: number): boolean => {
    const source = docSource(current.state.doc);
    const language = current.state.field(languageField);
    if (language === "typst") {
      const features = current.state.field(typstFeaturesField);
      if (features.link) {
        const link = typstLinkAt(source, offset, features);
        if (link) {
          void openExternalUrl(link.href);
          return true;
        }
      }
      if (features.hash) {
        const include = typstIncludeAt(source, offset);
        if (include && includeFollow) {
          includeFollow(include.path);
          return true;
        }
      }
      return false;
    }
    const features = current.state.field(featuresField);
    if (features.wiki) {
      const wiki = wikiLinkAt(source, offset);
      if (wiki && wikiFollow) {
        wikiFollow(wiki.target);
        return true;
      }
    }
    if (features.externalLink) {
      const link = externalLinkAt(source, offset);
      if (link) {
        void openExternalUrl(link.href);
        return true;
      }
    }
    return false;
  };

  const view = new EditorView({
    parent,
    state: EditorState.create({
      extensions: [
        showMarksField,
        pointerSelectingField,
        featuresField,
        typstFeaturesField,
        assetBaseField,
        graphicField,
        languageField,
        goalColumnField,
        markdownDecorations,
        highlightModeField,
        highlightDecorations,
        headingPrefixAtoms(),
        headingKeymap(),
        graphicNavKeymap(),
        undoHistory.of(history()),
        keymap.of([
          {
            key: "Mod-Enter",
            run: (current) =>
              followAt(current, current.state.selection.main.head),
          },
          { key: "Mod-Enter", run: toggleTodoAtCaret },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        drawSelection({ cursorBlinkRate: 2000 }),
        EditorView.lineWrapping,
        EditorState.tabSize.of(4),
        EditorView.contentAttributes.of({ spellcheck: "false" }),
        editable.of(surfaceEditability(true)),
        paperTheme,
        EditorView.mouseSelectionStyle.of(paperMouseSelectionStyle),
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
            return followAt(current, pos);
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

  // Defer mark-reveal while CodeMirror owns the complete standard pointer
  // gesture (single/shift/double/triple click, drag, drag-move, auto-scroll).
  // After mouseup, mark-reveal still mutates the DOM; keep a short selection
  // lock so WebKit's stale contenteditable caret cannot win.
  let lockSnap: { anchor: number; head: number } | null = null;
  let lockUntilMs = 0;
  let pointerGesture = 0;
  let cancelPointerEnd: (() => void) | null = null;
  const snapPointerSelection = (): void => {
    const snap =
      lockSnap && selectionLockHolds(lockUntilMs, Date.now())
        ? lockSnap
        : null;
    if (!snap) {
      return;
    }
    const main = view.state.selection.main;
    if (main.anchor === snap.anchor && main.head === snap.head) {
      return;
    }
    view.dispatch({ selection: snap });
  };
  const armSelectionLock = (snap: { anchor: number; head: number }): void => {
    lockSnap = snap;
    lockUntilMs = Date.now() + 180;
  };
  const releaseSelectionLock = (): void => {
    lockSnap = null;
    lockUntilMs = 0;
    document.removeEventListener("selectionchange", onNativeSelectionDrift);
  };
  const onNativeSelectionDrift = (): void => {
    if (lockSnap !== null && selectionLockHolds(lockUntilMs, Date.now())) {
      snapPointerSelection();
    }
  };
  const onPointerSelectStart = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return;
    }
    // Graphic widgets own their click → source mapping.
    const hit =
      event.target instanceof Element
        ? event.target
        : event.target instanceof Node
          ? event.target.parentElement
          : null;
    if (hit?.closest(".md-table-wrap, .md-code-card, .md-hr-wrap")) {
      return;
    }
    pointerGesture += 1;
    const gesture = pointerGesture;
    lockSnap = null;
    lockUntilMs = 0;
    document.removeEventListener("selectionchange", onNativeSelectionDrift);
    view.dispatch({ effects: setPointerSelecting.of(true) });

    const endSelect = (): void => {
      cancelPointerEnd = null;
      const finish = (): void => {
        if (gesture !== pointerGesture) {
          return;
        }
        if (!view.state.field(pointerSelectingField)) {
          return;
        }
        const main = view.state.selection.main;
        const snap = { anchor: main.anchor, head: main.head };
        armSelectionLock(snap);
        document.addEventListener("selectionchange", onNativeSelectionDrift);
        view.dispatch({
          effects: setPointerSelecting.of(false),
          selection: snap,
        });
        // Reveal mutates DOM; keep re-asserting through the lock window.
        snapPointerSelection();
        window.setTimeout(() => {
          snapPointerSelection();
          if (!selectionLockHolds(lockUntilMs, Date.now())) {
            document.removeEventListener(
              "selectionchange",
              onNativeSelectionDrift,
            );
            lockSnap = null;
          }
        }, 200);
      };
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(finish);
      });
    };
    cancelPointerEnd?.();
    cancelPointerEnd = onGestureEnd(window, endSelect);
  };
  view.contentDOM.addEventListener("mousedown", onPointerSelectStart, true);
  const onLinkHelperKeyDown = (event: KeyboardEvent): void => {
    // A keyboard gesture supersedes the short post-pointer WebKit lock.
    releaseSelectionLock();
    if (
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown" &&
      event.key !== "Enter" &&
      event.key !== "Escape"
    ) {
      return;
    }
    if (!linkHelperKeys?.(event.key)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  view.contentDOM.addEventListener("keydown", onLinkHelperKeyDown, true);

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
    getDocument: () => docSource(view.state.doc),
    setDocument: (
      text: string,
      caretLine?: number,
      resetUndo = false,
    ): void => {
      const caret =
        caretLine === undefined
          ? undefined
          : offsetAtLine(text, caretLine);
      if (resetUndo) {
        replaceDocumentWithFreshHistory(view, undoHistory, text, caret);
        return;
      }
      loadDocument(view, text, caret);
    },
    getCaretOffset: () => view.state.selection.main.head,
    setCaretOffset: (offset: number): void => {
      const caret = Math.min(Math.max(offset, 0), view.state.doc.length);
      view.dispatch({ selection: { anchor: caret } });
    },
    isSelectionEmpty: (): boolean => view.state.selection.main.empty,
    caretScreenBox: (): CaretScreenBox | null => {
      const caret = view.state.selection.main.head;
      const box =
        view.coordsAtPos(caret) ??
        view.coordsAtPos(Math.max(0, caret - 1));
      if (!box) {
        return null;
      }
      return { left: box.left, bottom: box.bottom };
    },
    replaceRange: (from: number, to: number, text: string): void => {
      const insertFrom = Math.max(0, Math.min(from, view.state.doc.length));
      const insertTo = Math.max(
        insertFrom,
        Math.min(to, view.state.doc.length),
      );
      view.dispatch({
        changes: { from: insertFrom, to: insertTo, insert: text },
        selection: { anchor: insertFrom + text.length },
      });
    },
    offsetAtClientPoint: (clientX: number, clientY: number): number | undefined => {
      return view.posAtCoords({ x: clientX, y: clientY }) ?? undefined;
    },
    revealCaret: (): void => {
      revealCaretLine(view.scrollDOM, measureMarkdownCaretTopPx(view));
    },
    setSurface: (surface: PaperSurface): void => {
      const showMarks = surface === "edit";
      view.dispatch({
        effects: [
          editable.reconfigure(surfaceEditability(showMarks)),
          setShowMarks.of(showMarks),
        ],
      });
    },
    setLanguage: (language: PaperLanguage): void => {
      view.dispatch({ effects: setLanguageEffect.of(language) });
    },
    setHighlightMode: (mode: HighlightMode): void => {
      view.dispatch({ effects: setHighlightModeEffect.of(mode) });
    },
    setFeatures: (features: MarkdownFeatures): void => {
      view.dispatch({ effects: setFeaturesEffect.of(features) });
    },
    setTypstFeatures: (features: TypstFeatures): void => {
      view.dispatch({ effects: setTypstFeaturesEffect.of(features) });
    },
    setAssetBase: (dir: string | null, projectRoot: string | null = null): void => {
      view.dispatch({ effects: setAssetBaseEffect.of({ dir, projectRoot }) });
    },
    setGraphic: (enabled: boolean): void => {
      view.dispatch({ effects: setGraphicEffect.of(enabled) });
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
    setIncludeFollow: (handler): void => {
      includeFollow = handler;
    },
    setLinkHelperKeys: (handler): void => {
      linkHelperKeys = handler;
    },
    focus: () => {
      view.focus();
    },
    destroy: () => {
      view.contentDOM.removeEventListener(
        "mousedown",
        onPointerSelectStart,
        true,
      );
      view.contentDOM.removeEventListener(
        "keydown",
        onLinkHelperKeyDown,
        true,
      );
      releaseSelectionLock();
      cancelPointerEnd?.();
      caretListeners.clear();
      changeListeners.clear();
      view.destroy();
    },
  };
}

/**
 * Keeps CodeMirror's standard mouse gesture engine while replacing only its
 * coordinate mapping, which must account for JustPaper's hidden markdown
 * marks and rendered widgets.
 */
function paperMouseSelectionStyle(
  view: EditorView,
  startEvent: MouseEvent,
): MouseSelectionStyle | null {
  if (startEvent.button !== 0) {
    return null;
  }
  let startPoint = pointerPoint(view, startEvent);
  const recent = recentPointerClicks.get(view);
  if (startEvent.detail > 1 && !startPoint && recent) {
    startPoint = recent;
  }
  if (!startPoint) {
    return null;
  }
  if (startEvent.detail === 1) {
    recentPointerClicks.set(view, startPoint);
  } else if (startEvent.detail >= 3) {
    recentPointerClicks.delete(view);
  }

  const clickCount: 1 | 2 | 3 =
    startEvent.detail >= 3 ? 3 : startEvent.detail === 2 ? 2 : 1;
  let startPos = startPoint.pos;
  let startRange = pointerRangeForView(
    view,
    startPoint,
    startEvent,
    clickCount,
  );
  let startSelection = view.state.selection;

  return {
    update(update: ViewUpdate): void {
      if (!update.docChanged) {
        return;
      }
      startPos = update.changes.mapPos(startPos);
      startRange = startRange.map(update.changes);
      startSelection = startSelection.map(update.changes);
    },
    get(
      currentEvent: MouseEvent,
      extend: boolean,
      multiple: boolean,
    ): EditorSelection {
      const currentPoint = pointerPoint(view, currentEvent, true) ?? startPoint;
      const currentRange =
        currentEvent.clientX === startEvent.clientX &&
        currentEvent.clientY === startEvent.clientY
          ? startRange
          : pointerRangeForView(
              view,
              currentPoint,
              currentEvent,
              clickCount,
            );
      if (extend) {
        return startSelection.replaceRange(
          startSelection.main.extend(
            currentRange.from,
            currentRange.to,
            currentRange.assoc,
          ),
        );
      }
      const range = spanPointerRanges(
        startRange,
        currentRange,
        startPos,
        currentPoint.pos,
      );
      if (multiple) {
        return startSelection.addRange(range);
      }
      return EditorSelection.create([range]);
    },
  };
}

function pointerRangeForView(
  view: EditorView,
  point: PointerPoint,
  event: MouseEvent,
  clickCount: 1 | 2 | 3,
): SelectionRange {
  if (clickCount === 1 || clickCount === 2) {
    return pointerRangeAt(view.state, point.pos, clickCount, point.bias);
  }
  return visualRowRangeAt(
    view.state,
    point.pos,
    event.clientY,
    visualRowHitsNear(view, point.pos, event.clientY),
  );
}

/** Collects only the clicked visual row instead of scanning a long paragraph. */
function visualRowHitsNear(
  view: EditorView,
  position: number,
  clientY: number,
): VisualRowHit[] {
  const line = view.state.doc.lineAt(position);
  const boxesAt = (pos: number): VisualRowHit[] => {
    const hits: VisualRowHit[] = [];
    for (const side of [-1, 1] as const) {
      const box = view.coordsAtPos(pos, side);
      if (box) {
        hits.push({ pos, top: box.top, bottom: box.bottom });
      }
    }
    return hits;
  };
  const seed = boxesAt(position).sort(
    (a, b) =>
      Math.abs((a.top + a.bottom) / 2 - clientY) -
      Math.abs((b.top + b.bottom) / 2 - clientY),
  )[0];
  if (!seed) {
    return [];
  }
  const middle = (seed.top + seed.bottom) / 2;
  const slack = Math.max(2, (seed.bottom - seed.top) * 0.45);
  const onRow = (hit: VisualRowHit): boolean =>
    Math.abs((hit.top + hit.bottom) / 2 - middle) <= slack;
  const hits: VisualRowHit[] = [];
  hits.push(...boxesAt(position).filter(onRow));
  for (let pos = position - 1; pos >= line.from; pos -= 1) {
    const rowHits = boxesAt(pos).filter(onRow);
    if (rowHits.length === 0) {
      break;
    }
    hits.push(...rowHits);
  }
  for (let pos = position + 1; pos <= line.to; pos += 1) {
    const rowHits = boxesAt(pos).filter(onRow);
    if (rowHits.length === 0) {
      break;
    }
    hits.push(...rowHits);
  }
  return hits;
}

function pointerPoint(
  view: EditorView,
  event: MouseEvent,
  allowImprecise = false,
): PointerPoint | null {
  const pos = posAtClick(view, event.clientX, event.clientY);
  if (pos === null) {
    if (!allowImprecise) {
      return null;
    }
    const estimated = view.posAndSideAtCoords(
      { x: event.clientX, y: event.clientY },
      false,
    );
    return { pos: estimated.pos, bias: estimated.assoc };
  }
  const nativeSide = view.posAndSideAtCoords({
    x: event.clientX,
    y: event.clientY,
  });
  if (nativeSide?.pos === pos) {
    return { pos, bias: nativeSide.assoc };
  }
  const box = view.coordsAtPos(pos);
  const visuallyBefore =
    box && view.textDirectionAt(pos) === Direction.RTL
      ? event.clientX > (box.left + box.right) / 2
      : box && event.clientX < (box.left + box.right) / 2;
  const bias = visuallyBefore ? -1 : 1;
  return { pos, bias };
}

const atomicRangeCache = new WeakMap<EditorState, DecorationSet>();

/**
 * Makes hidden syntax (ATX prefix, todo box, hidden marks) atomic for caret
 * motion; computed once per editor state from the shared parse cache.
 */
function headingPrefixAtoms() {
  return EditorView.atomicRanges.of((view) => {
    const state = view.state;
    let ranges = atomicRangeCache.get(state);
    if (!ranges) {
      ranges = atomicRangesFor(state);
      atomicRangeCache.set(state, ranges);
    }
    return ranges;
  });
}

function atomicRangesFor(state: EditorState): DecorationSet {
  const source = docSource(state.doc);
  const showMarks = state.field(showMarksField);
  const caret = state.selection.main.head;
  const ranges =
    state.field(languageField) === "typst"
      ? typstAtomicSyntaxRanges(
          typstBlocks(state.doc, state.field(typstFeaturesField)),
          { showMarks, caret, source },
        )
      : atomicSyntaxRanges(markdownBlocks(state.doc, state.field(featuresField)), {
          showMarks,
          graphic: state.field(graphicField),
          source,
          caret,
        });
  return Decoration.set(
    ranges
      .filter((range) => range.to > range.from)
      .map((range) => Decoration.mark({}).range(range.from, range.to)),
    true,
  );
}

function headingKeymap() {
  return Prec.high(
    keymap.of([
      {
        key: "#",
        run: (view) =>
          view.state.field(languageField) === "markdown" &&
          applyAtxEdit(view, addAtxHash),
      },
      {
        key: "=",
        run: (view) =>
          view.state.field(languageField) === "typst" &&
          applyHeadingEdit(view, (doc, pos) => addHeadingMark(doc, pos)),
      },
      {
        key: "Backspace",
        run: (view) => {
          const language = view.state.field(languageField);
          if (language === "typst") {
            return applyHeadingEdit(view, (doc, pos) =>
              removeHeadingMark(doc, pos),
            );
          }
          if (language === "markdown") {
            return applyAtxEdit(view, removeAtxHash);
          }
          return false;
        },
      },
    ]),
  );
}

function graphicNavKeymap() {
  return Prec.highest(
    keymap.of([
      {
        key: "ArrowDown",
        run: (view) => enterGraphic(view, 1, "along"),
      },
      {
        key: "ArrowUp",
        run: (view) => enterGraphic(view, -1, "along"),
      },
      {
        key: "ArrowRight",
        run: (view) => enterGraphic(view, 1, "across"),
      },
      {
        key: "ArrowLeft",
        run: (view) => enterGraphic(view, -1, "across"),
      },
    ]),
  );
}

/**
 * Arrow motion: enter graphic widgets when needed, otherwise move by visual row
 * (soft wrap) / character — same geometry as click positioning. Vertical moves
 * keep a goal column across consecutive presses; horizontal moves follow the
 * text direction at the caret. The moved caret is scrolled into view.
 */
function enterGraphic(
  view: EditorView,
  direction: 1 | -1,
  axis: "along" | "across",
): boolean {
  if (!view.state.selection.main.empty) {
    return false;
  }
  const state = view.state;
  const source = docSource(state.doc);
  const graphic = state.field(graphicField);
  const showMarks = state.field(showMarksField);
  const blocks =
    state.field(languageField) === "markdown"
      ? markdownBlocks(state.doc, state.field(featuresField))
      : [];
  const spans = graphic && showMarks ? graphicSpans(blocks) : [];
  const caret = state.selection.main.head;
  const goalX =
    axis === "along"
      ? (state.field(goalColumnField) ?? caretScreenX(view, caret))
      : undefined;
  const step =
    axis === "across"
      ? logicalDirection(direction, view.textDirectionAt(caret) === Direction.RTL)
      : direction;

  let next: number | undefined =
    spans.length === 0
      ? undefined
      : axis === "along"
        ? enterGraphicAlong(source, spans, caret, step)
        : enterGraphicAcross(source, spans, caret, step);

  if (next === undefined && axis === "along") {
    next = moveVisualLine(view, step, goalX) ?? undefined;
    if (isVisualLineStep(caret, next) && spans.length > 0) {
      next = caretSkippedGraphic(source, spans, caret, next) ?? next;
    }
  }
  if (next === undefined && axis === "across") {
    const moved = view.moveByChar(state.selection.main, step === 1);
    next = moved.head;
    if (spans.length > 0) {
      next = caretSkippedGraphic(source, spans, caret, next) ?? next;
    }
  }
  if (!isVisualLineStep(caret, next) && axis === "along") {
    // Doc edge or failed probe — let CM handle / no-op.
    return next !== undefined && next === caret;
  }
  if (next === undefined) {
    return false;
  }
  const span = spans.find((entry) =>
    caretRevealsTable(source, entry, next),
  );
  // Only map onto the widget when entering from outside — interior motion
  // keeps the visual-line target (and avoids stale/wrong widget hits).
  if (span && !caretRevealsTable(source, span, caret)) {
    next = refineGraphicEnter(
      view,
      blocks,
      span,
      next,
      caret,
      goalX,
      step,
      axis,
    );
  }
  view.dispatch(caretMoveSpec(next, goalX));
  return true;
}

/**
 * Screen x of the caret at `pos` (falling back to the previous character).
 */
function caretScreenX(view: EditorView, pos: number): number | undefined {
  const coords =
    view.coordsAtPos(pos) ?? (pos > 0 ? view.coordsAtPos(pos - 1) : null);
  return coords && Number.isFinite(coords.left) ? coords.left : undefined;
}

/**
 * Moves one soft-wrapped visual row, aiming for the goal column `goalX`
 * (the caret's own x when no goal is known).
 */
function moveVisualLine(
  view: EditorView,
  direction: 1 | -1,
  goalX: number | undefined,
): number | null {
  const caret = view.state.selection.main.head;
  let box = view.coordsAtPos(caret);
  if (!box || !Number.isFinite(box.left)) {
    box = view.coordsAtPos(Math.max(0, caret - 1));
  }
  if (!box || !Number.isFinite(box.left)) {
    return view.moveVertically(view.state.selection.main, direction === 1).head;
  }
  const x = goalX ?? box.left;
  const y = visualLineProbeY(box, direction);
  const probed = posAtClick(view, x, y);
  if (probed !== null && probed !== caret) {
    return probed;
  }
  return view.moveVertically(view.state.selection.main, direction === 1).head;
}

/**
 * Maps arrow-enter onto the rendered widget at the goal column (or the
 * caret's own x for horizontal moves).
 */
function refineGraphicEnter(
  view: EditorView,
  blocks: Block[],
  span: GraphicSpan,
  fallback: number,
  caret: number,
  goalX: number | undefined,
  direction: 1 | -1,
  axis: "along" | "across",
): number {
  const widget = findGraphicWidget(view, span.from);
  if (!widget) {
    return fallback;
  }
  let caretCoords = view.coordsAtPos(caret);
  if (
    (!caretCoords || !Number.isFinite(caretCoords.left)) &&
    caret > 0
  ) {
    caretCoords = view.coordsAtPos(caret - 1);
  }
  const left =
    goalX ??
    (caretCoords && Number.isFinite(caretCoords.left)
      ? caretCoords.left
      : undefined);
  const point = enterClientPoint(
    left !== undefined && caretCoords
      ? {
          left,
          top: caretCoords.top,
          bottom: caretCoords.bottom,
        }
      : left !== undefined
        ? { left, top: 0, bottom: 0 }
        : null,
    widget.getBoundingClientRect(),
    direction,
    axis,
  );
  if (widget.classList.contains("md-table-wrap")) {
    return (
      sourcePosFromTablePoint(
        (from, to) => view.state.doc.sliceString(from, to),
        widget,
        point.x,
        point.y,
        view.state.field(featuresField),
      ) ?? fallback
    );
  }
  if (widget.classList.contains("md-code-card")) {
    const block = blocks.find(
      (entry) => entry.kind === "codeblock" && entry.from === span.from,
    );
    if (block?.kind === "codeblock") {
      const bodyTo = block.close?.from ?? block.to;
      const body = view.state.doc.sliceString(block.open.to, bodyTo);
      return sourcePosFromCodeClick(
        block.open.to,
        body,
        widget,
        point.x,
        point.y,
      );
    }
  }
  return fallback;
}

/**
 * Resolves a click to a document position using the visual row under the cursor.
 * Soft-wrap: never trust posAtCoords alone for the line — WebKit often reports
 * the next block for wrapped rows. Prefer the cm-line under the pointer, then
 * pick the offset via coordsAtPos on that line (and native caret as fallback).
 */
function posAtClick(
  view: EditorView,
  clientX: number,
  clientY: number,
): number | null {
  // 1) Native caret — WKWebView soft-wrap is usually accurate here.
  const native = posFromNativeCaretPoint(view, clientX, clientY);
  if (native !== null) {
    return native;
  }

  // 2) cm-line under the pointer + coordsAtPos scan across its soft-wrap rows.
  const lineRange = docLineRangeFromDom(view, clientY);
  if (lineRange) {
    const scanned = bestPosOnLineByCoords(
      lineRange.from,
      lineRange.to,
      clientX,
      clientY,
      (pos) => view.coordsAtPos(pos),
    );
    if (scanned !== undefined) {
      return scanned;
    }
  }

  // 3) Glyph getClientRects mapping inside the cm-line.
  const lineEl = cmLineAtClientY(view.contentDOM, clientY);
  if (lineEl) {
    const domPos = domPosFromGlyphPoint(lineEl, clientX, clientY);
    if (domPos) {
      try {
        return view.posAtDOM(domPos.node, domPos.offset);
      } catch {
        // Fall through.
      }
    }
  }

  // 4) posAtCoords only when it visually matches the click (no imprecise fallback).
  const rough = view.posAtCoords({ x: clientX, y: clientY });
  if (rough !== null) {
    const box = view.coordsAtPos(rough);
    if (clickPosMatchesPoint(clientX, clientY, box, 40, 120)) {
      return rough;
    }
  }
  return null;
}

/**
 * Logical doc line for the cm-line under `clientY` (covers all soft-wrap rows).
 */
function docLineRangeFromDom(
  view: EditorView,
  clientY: number,
): { from: number; to: number } | null {
  const lineEl = cmLineAtClientY(view.contentDOM, clientY);
  if (!lineEl) {
    return null;
  }
  try {
    const text = firstTextNode(lineEl);
    const from = text
      ? view.posAtDOM(text, 0)
      : view.posAtDOM(lineEl, 0);
    const line = view.state.doc.lineAt(from);
    return { from: line.from, to: line.to };
  } catch {
    return null;
  }
}

function firstTextNode(root: Node): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const node = walker.nextNode();
  return node instanceof Text ? node : null;
}

/**
 * WebKit/Chrome caret APIs mapped into the document, rejected when far from the click.
 */
function posFromNativeCaretPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
): number | null {
  const caret = nativeCaretFromPoint(clientX, clientY);
  if (!caret || !view.contentDOM.contains(caret.node)) {
    return null;
  }
  try {
    const docPos = view.posAtDOM(caret.node, caret.offset);
    const box =
      view.coordsAtPos(docPos) ?? view.coordsAtPos(Math.max(0, docPos - 1));
    if (!clickPosMatchesPoint(clientX, clientY, box, 40, 120)) {
      return null;
    }
    return docPos;
  } catch {
    return null;
  }
}

/**
 * Finds the soft-wrapped CM line whose vertical band contains `clientY`.
 */
function cmLineAtClientY(
  content: HTMLElement,
  clientY: number,
): HTMLElement | null {
  const lines = content.querySelectorAll(".cm-line");
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const line of lines) {
    if (!(line instanceof HTMLElement)) {
      continue;
    }
    const box = line.getBoundingClientRect();
    if (clientY >= box.top && clientY <= box.bottom) {
      return line;
    }
    const mid = (box.top + box.bottom) / 2;
    const dist = Math.abs(mid - clientY);
    if (dist < bestDist) {
      bestDist = dist;
      best = line;
    }
  }
  return best;
}

/**
 * Finds the DOM node for a graphic widget starting at `pos`.
 * Matches the widget for this position only — never the first widget in content.
 */
function findGraphicWidget(
  view: EditorView,
  pos: number,
): HTMLElement | null {
  const probe = (at: number): HTMLElement | null => {
    try {
      const { node, offset } = view.domAtPos(at);
      const widget = graphicWidgetFromDomPos(node, offset);
      if (!widget) {
        return null;
      }
      // Block widgets report their replace-from via posAtDOM.
      const widgetPos = view.posAtDOM(widget);
      if (Math.abs(widgetPos - at) > 1) {
        return null;
      }
      return widget;
    } catch {
      return null;
    }
  };
  return probe(pos) ?? (pos > 0 ? probe(pos - 1) : null);
}

function graphicSpans(blocks: Block[]): GraphicSpan[] {
  const spans: GraphicSpan[] = [];
  for (const block of blocks) {
    if (
      block.kind === "table" ||
      block.kind === "codeblock" ||
      block.kind === "hr"
    ) {
      spans.push({ from: block.from, to: block.to });
    }
  }
  return spans;
}

/**
 * Edit surface is editable; View is read-only, so neither input nor commands
 * (keymaps, widget clicks) mutate the document there.
 */
function surfaceEditability(editable: boolean) {
  return [
    EditorView.editable.of(editable),
    EditorState.readOnly.of(!editable),
  ];
}

/**
 * Toggles the task box on the caret line (markdown, todos enabled, editable).
 */
function toggleTodoAtCaret(view: EditorView): boolean {
  const state = view.state;
  if (
    state.readOnly ||
    state.field(languageField) !== "markdown" ||
    !state.field(featuresField).todo
  ) {
    return false;
  }
  const line = state.doc.lineAt(state.selection.main.head);
  const toggle = todoToggleOnLine(docSource(state.doc), line.from, line.to);
  if (!toggle) {
    return false;
  }
  view.dispatch({ changes: toggle });
  return true;
}

function applyAtxEdit(
  view: EditorView,
  edit: (doc: string, pos: number, blocks: Block[]) => AtxEdit | undefined,
): boolean {
  if (!view.state.facet(EditorView.editable)) {
    return false;
  }
  if (!view.state.field(featuresField).heading) {
    return false;
  }
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return false;
  }
  const state = view.state;
  const next = edit(
    docSource(state.doc),
    selection.head,
    markdownBlocks(state.doc, state.field(featuresField)),
  );
  if (!next) {
    return false;
  }
  view.dispatch({
    changes: { from: next.from, to: next.to, insert: next.insert },
    selection: { anchor: next.caret },
  });
  return true;
}

function applyHeadingEdit(
  view: EditorView,
  edit: (doc: string, pos: number) => HeadingEdit | undefined,
): boolean {
  if (!view.state.facet(EditorView.editable)) {
    return false;
  }
  if (!view.state.field(typstFeaturesField).heading) {
    return false;
  }
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return false;
  }
  const next = edit(docSource(view.state.doc), selection.head);
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
    docSource(state.doc),
    state.selection.main.head,
    state.field(highlightModeField),
    state.field(languageField),
  );
  const mark = Decoration.mark({ class: "highlight-dim" });
  return Decoration.set(
    ranges
      .filter((range) => range.to > range.from)
      .map((range) => mark.range(range.from, range.to)),
    true,
  );
}

/**
 * Fingerprint of the marks/widgets revealed for `caret` in `state`'s document.
 */
function revealKey(state: EditorState, caret: number): string {
  const source = docSource(state.doc);
  const showMarks = state.field(showMarksField);
  if (state.field(languageField) === "typst") {
    return typstDecorationRevealKey(
      typstBlocks(state.doc, state.field(typstFeaturesField)),
      { showMarks, caret, source },
    );
  }
  return decorationRevealKey(
    markdownBlocks(state.doc, state.field(featuresField)),
    { showMarks, graphic: state.field(graphicField), source, caret },
  );
}

/**
 * Builds the syntax decorations for `state` from the shared parse cache.
 */
function decorationsFor(state: EditorState): DecorationSet {
  const source = docSource(state.doc);
  const showMarks = state.field(showMarksField);
  const features = state.field(featuresField);
  const caret = state.selection.main.head;
  const assetBase = state.field(assetBaseField);
  const specs =
    state.field(languageField) === "typst"
      ? typstDecorationSpecs(
          typstBlocks(state.doc, state.field(typstFeaturesField)),
          {
            showMarks,
            caret,
            source,
            projectRoot: assetBase.projectRoot ?? undefined,
          },
        )
      : decorationSpecs(markdownBlocks(state.doc, features), {
          showMarks,
          graphic: state.field(graphicField),
          source,
          caret,
          features,
        });
  const context: WidgetContext = {
    assetBase: assetBase.dir,
    features,
    editable: showMarks,
  };
  return Decoration.set(
    specs.flatMap((spec) => specToRanges(spec, context)),
    true,
  );
}

type WidgetContext = {
  assetBase: string | null;
  features: MarkdownFeatures;
  editable: boolean;
};

function specToRanges(
  spec: DecorationSpec,
  context: WidgetContext,
): Range<Decoration>[] {
  if (spec.kind.startsWith("line-h")) {
    const className = `md-h${spec.kind.slice("line-h".length)}`;
    return [Decoration.line({ class: className }).range(spec.from)];
  }
  if (spec.kind === "line-blockquote") {
    const callout =
      spec.calloutType !== undefined
        ? ` md-callout md-callout-${spec.calloutType}`
        : "";
    const part =
      spec.quotePart !== undefined ? ` md-quote-${spec.quotePart}` : "";
    return [
      Decoration.line({ class: `md-blockquote${callout}${part}` }).range(
        spec.from,
      ),
    ];
  }
  if (spec.kind === "line-todo") {
    return [Decoration.line({ class: "md-todo" }).range(spec.from)];
  }
  if (spec.kind === "line-list") {
    return [Decoration.line({ class: "md-list" }).range(spec.from)];
  }
  if (spec.from >= spec.to) {
    return [];
  }
  if (spec.kind === "todo-widget") {
    return [
      Decoration.replace({
        widget: new TodoWidget(spec.checked === true, context.editable),
      }).range(spec.from, spec.to),
    ];
  }
  if (spec.kind === "image-widget") {
    return [
      Decoration.replace({
        widget: new ImageWidget(
          displayImageSrc(
            spec.href ?? "",
            context.assetBase,
            context.features.externalImage,
          ),
          spec.alt ?? "",
        ),
      }).range(spec.from, spec.to),
    ];
  }
  if (spec.kind === "table-widget") {
    return [
      Decoration.replace({
        widget: new TableWidget(
          spec.header ?? [],
          spec.rows ?? [],
          spec.cellPositions ?? [],
          spec.opensSource === true,
          context.features,
        ),
        block: true,
      }).range(spec.from, spec.to),
    ];
  }
  if (spec.kind === "code-widget") {
    return [
      Decoration.replace({
        widget: new CodeWidget(
          spec.language ?? "",
          spec.body ?? "",
          spec.opensSource === true,
          spec.bodyFrom ?? spec.from,
        ),
        block: true,
      }).range(spec.from, spec.to),
    ];
  }
  if (spec.kind === "quote-widget") {
    return [
      Decoration.replace({
        widget: new QuoteWidget(
          spec.lines ?? [],
          spec.calloutType,
          spec.calloutTitle,
          spec.bodyNodes ?? [],
        ),
        block: true,
      }).range(spec.from, spec.to),
    ];
  }
  if (spec.kind === "hr-widget") {
    return [
      Decoration.replace({
        widget: new HrWidget(spec.opensSource === true),
        block: true,
      }).range(spec.from, spec.to),
    ];
  }
  if (spec.kind === "linebreak-widget") {
    return [
      Decoration.replace({
        widget: new LinebreakWidget(),
      }).range(spec.from, spec.to),
    ];
  }
  if (spec.kind === "glyph-widget") {
    return [
      Decoration.replace({
        widget: new GlyphWidget(spec.glyph ?? ""),
      }).range(spec.from, spec.to),
    ];
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

function displayImageSrc(
  href: string,
  assetBase: string | null,
  allowExternal: boolean,
): string | undefined {
  const resolved = resolveImageSrc(href, assetBase, allowExternal);
  if (!resolved) {
    return undefined;
  }
  if (resolved.startsWith("https://") || resolved.startsWith("http://")) {
    return resolved;
  }
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return convertFileSrc(resolved);
  }
  return resolved;
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
