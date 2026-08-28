import { linesPerPage, offsetAfterPage, offsetAtLine } from "./caret";
import { bindMarkdownEditor } from "./markdown/editor";
import type { MarkdownFeatures } from "./markdown/features";
import type { HighlightMode } from "./highlightMode";
import { LINE_CAPACITY } from "./pageLayout";
import { measureCaretTopPx, revealCaretLine, textareaOffsetAtClientPoint } from "./typewriter";
import {
  textareaLayoutHost,
  type ViewModeBinding,
} from "./viewMode";
import { wikiLinkAt } from "./wikiLink";

export type ParserMode = "plain" | "markdownEdit" | "markdownView";

export const DEFAULT_PARSER_MODE: ParserMode = "plain";

export type CheckedParserModeItems = {
  plain: boolean;
  markdownEdit: boolean;
  markdownView: boolean;
};

/**
 * Returns which parser-mode menu items should be checked.
 */
export function checkedParserModeItems(mode: ParserMode): CheckedParserModeItems {
  return {
    plain: mode === "plain",
    markdownEdit: mode === "markdownEdit",
    markdownView: mode === "markdownView",
  };
}

export type ParserModeBinding = {
  getParserMode: () => ParserMode;
  setParserMode: (mode: ParserMode) => void;
  getDocument: () => string;
  setDocument: (text: string, caretLine?: number) => void;
  getCaretOffset: () => number;
  setCaretOffset: (offset: number) => void;
  offsetAtClientPoint: (clientX: number, clientY: number) => number | undefined;
  scrollElement: () => HTMLElement;
  onScroll: (listener: () => void) => () => void;
  revealCaret: () => void;
  onChange: (listener: () => void) => () => void;
  onCaretOrDoc: (listener: () => void) => () => void;
  setWikiFollow: (handler: ((target: string) => void) | undefined) => void;
  applyHighlightMode: (mode: HighlightMode) => void;
  setMarkdownFeatures: (features: MarkdownFeatures) => void;
  setMarkdownGraphic: (enabled: boolean) => void;
  setAssetBase: (dir: string | null) => void;
  focus: () => void;
  disconnect: () => void;
};

/**
 * Switches between the plaintext textarea and the markdown CodeMirror surface.
 */
export function bindParserMode(
  textarea: HTMLTextAreaElement,
  markdownParent: HTMLElement,
  view: ViewModeBinding,
): ParserModeBinding {
  const markdown = bindMarkdownEditor(markdownParent);
  const plainHost = textareaLayoutHost(textarea);
  markdownParent.hidden = true;
  const changeListeners = new Set<() => void>();
  let wikiFollow: ((target: string) => void) | undefined;

  let mode: ParserMode = DEFAULT_PARSER_MODE;

  const notifyChange = (): void => {
    for (const listener of changeListeners) {
      listener();
    }
  };

  const followWikiAt = (offset: number): boolean => {
    const link = wikiLinkAt(textarea.value, offset);
    if (!link || !wikiFollow) {
      return false;
    }
    wikiFollow(link.target);
    return true;
  };

  const apply = (next: ParserMode): void => {
    if (next === "plain") {
      textarea.value = markdown.getDocument();
      markdownParent.hidden = true;
      markdownParent.classList.remove("is-view");
      textarea.hidden = false;
      view.setHost(plainHost);
      textarea.focus();
      return;
    }

    if (mode === "plain") {
      markdown.setDocument(textarea.value);
    }
    textarea.hidden = true;
    markdownParent.hidden = false;
    markdownParent.classList.toggle("is-view", next === "markdownView");
    markdown.setSurface(next);
    view.setHost({
      layoutElement: markdown.layoutElement,
      typewriter:
        next === "markdownEdit" ? markdown.typewriterTarget : undefined,
    });
    if (next === "markdownEdit") {
      markdown.focus();
    }
  };

  const setParserMode = (next: ParserMode): void => {
    if (next === mode) {
      return;
    }
    apply(next);
    mode = next;
  };

  const onParserEvent = (event: Event): void => {
    const next = (event as CustomEvent<unknown>).detail;
    if (next === "plain" || next === "markdownEdit" || next === "markdownView") {
      setParserMode(next);
    }
  };
  markdownParent.addEventListener("justpaper-parser-mode", onParserEvent);

  const onPlainInput = (): void => {
    notifyChange();
  };
  const onPlainClick = (event: MouseEvent): void => {
    if (!event.metaKey && !event.ctrlKey) {
      return;
    }
    followWikiAt(textarea.selectionStart);
  };
  const onPlainKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      const direction = event.key === "PageDown" ? 1 : -1;
      const lineHeightPx = parseFloat(getComputedStyle(textarea).lineHeight);
      const next = offsetAfterPage(
        textarea.value,
        textarea.selectionEnd,
        direction,
        linesPerPage(textarea.clientHeight, lineHeightPx),
        LINE_CAPACITY,
      );
      textarea.setSelectionRange(next, next);
      return;
    }
    if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) {
      return;
    }
    if (followWikiAt(textarea.selectionStart)) {
      event.preventDefault();
    }
  };
  textarea.addEventListener("input", onPlainInput);
  textarea.addEventListener("click", onPlainClick);
  textarea.addEventListener("keydown", onPlainKeyDown);
  const stopMarkdownChange = markdown.onChange(notifyChange);

  const getDocument = (): string =>
    mode === "plain" ? textarea.value : markdown.getDocument();

  const setDocument = (text: string, caretLine?: number): void => {
    textarea.value = text;
    if (caretLine !== undefined) {
      const caret = offsetAtLine(text, caretLine);
      textarea.setSelectionRange(caret, caret);
    }
    markdown.setDocument(text, caretLine);
  };

  const getCaretOffset = (): number =>
    mode === "plain" ? textarea.selectionStart : markdown.getCaretOffset();

  const setCaretOffset = (offset: number): void => {
    if (mode === "plain") {
      const caret = Math.min(Math.max(offset, 0), textarea.value.length);
      textarea.setSelectionRange(caret, caret);
      return;
    }
    markdown.setCaretOffset(offset);
  };

  const revealCaret = (): void => {
    if (mode === "plain") {
      revealCaretLine(textarea, measureCaretTopPx(textarea));
      return;
    }
    markdown.revealCaret();
  };

  const offsetAtClientPoint = (
    clientX: number,
    clientY: number,
  ): number | undefined => {
    if (mode === "plain") {
      return textareaOffsetAtClientPoint(textarea, clientY);
    }
    return markdown.offsetAtClientPoint(clientX, clientY);
  };

  const scrollElement = (): HTMLElement =>
    mode === "plain" ? textarea : markdown.layoutElement;

  const focus = (): void => {
    if (mode === "plain") {
      textarea.focus();
      return;
    }
    markdown.focus();
  };

  return {
    getParserMode: () => mode,
    setParserMode,
    getDocument,
    setDocument,
    getCaretOffset,
    setCaretOffset,
    offsetAtClientPoint,
    scrollElement,
    onScroll: (listener: () => void): (() => void) => {
      textarea.addEventListener("scroll", listener);
      markdown.layoutElement.addEventListener("scroll", listener);
      return () => {
        textarea.removeEventListener("scroll", listener);
        markdown.layoutElement.removeEventListener("scroll", listener);
      };
    },
    revealCaret,
    onChange: (listener: () => void): (() => void) => {
      changeListeners.add(listener);
      return () => {
        changeListeners.delete(listener);
      };
    },
    onCaretOrDoc: (listener: () => void): (() => void) => {
      const onPlainCaret = (): void => {
        if (mode !== "plain") {
          return;
        }
        listener();
      };
      const onSelection = (): void => {
        if (document.activeElement === textarea) {
          onPlainCaret();
        }
      };
      textarea.addEventListener("input", onPlainCaret);
      textarea.addEventListener("click", onPlainCaret);
      textarea.addEventListener("keyup", onPlainCaret);
      document.addEventListener("selectionchange", onSelection);
      const stopMarkdown = markdown.typewriterTarget.onCaretMoved(listener);
      return () => {
        textarea.removeEventListener("input", onPlainCaret);
        textarea.removeEventListener("click", onPlainCaret);
        textarea.removeEventListener("keyup", onPlainCaret);
        document.removeEventListener("selectionchange", onSelection);
        stopMarkdown();
      };
    },
    setWikiFollow: (handler): void => {
      wikiFollow = handler;
      markdown.setWikiFollow(handler);
    },
    applyHighlightMode: (mode: HighlightMode): void => {
      markdown.setHighlightMode(mode);
    },
    setMarkdownFeatures: (features: MarkdownFeatures): void => {
      markdown.setFeatures(features);
    },
    setMarkdownGraphic: (enabled: boolean): void => {
      markdown.setGraphic(enabled);
    },
    setAssetBase: (dir: string | null): void => {
      markdown.setAssetBase(dir);
    },
    focus,
    disconnect: (): void => {
      markdownParent.removeEventListener("justpaper-parser-mode", onParserEvent);
      textarea.removeEventListener("input", onPlainInput);
      textarea.removeEventListener("click", onPlainClick);
      textarea.removeEventListener("keydown", onPlainKeyDown);
      stopMarkdownChange();
      markdown.destroy();
    },
  };
}
