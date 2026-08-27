import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/400-italic.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/courier-prime/700-italic.css";
import "./paper.css";
import "./markdown.css";
import "./chrome.css";
import { bindAppMenu } from "./appMenu";
import { bindDocument } from "./document";
import { bindFilenameBar } from "./filenameBar";
import { fuzzyMatch } from "./fuzzyMatch";
import { bindHighlightMode } from "./highlightMode";
import { bindPalette } from "./palette";
import { bindParagraphNav } from "./paragraphNav";
import { bindParserMode } from "./parserMode";
import { bindSettings } from "./settings";
import { bindViewMode, textareaLayoutHost } from "./viewMode";
import {
  bindFullscreenClass,
  bindTitleDoubleClick,
  bindTrafficLights,
  bindWindowChrome,
} from "./windowChrome";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
}

window.addEventListener("DOMContentLoaded", () => {
  const editor = requiredElement<HTMLTextAreaElement>("editor");
  const view = bindViewMode(textareaLayoutHost(editor));
  const parser = bindParserMode(editor, requiredElement("markdown"), view);
  const highlight = bindHighlightMode(editor, requiredElement("highlight"), {
    applyHighlightMode: parser.applyHighlightMode,
    onCaretOrDoc: parser.onCaretOrDoc,
  });
  const settings = bindSettings(document.documentElement, {
    fontSize: (size) => {
      view.setFontSize(size);
    },
    viewMode: (mode) => {
      view.setViewMode(mode);
    },
    parserMode: (mode) => {
      parser.setParserMode(mode);
    },
    highlightMode: (mode) => {
      highlight.setHighlightMode(mode);
    },
  });
  const paragraphNav = bindParagraphNav(requiredElement("paragraph-nav"), {
    getDocument: parser.getDocument,
    getCaretOffset: parser.getCaretOffset,
    setCaretOffset: parser.setCaretOffset,
    revealCaret: parser.revealCaret,
    focus: parser.focus,
    onCaretOrDoc: parser.onCaretOrDoc,
  });
  const paperDoc = bindDocument({
    getText: parser.getDocument,
    setText: parser.setDocument,
    getCaretOffset: parser.getCaretOffset,
    setCaretOffset: parser.setCaretOffset,
    revealCaret: parser.revealCaret,
    focus: parser.focus,
    onChange: parser.onChange,
    onCaretOrDoc: parser.onCaretOrDoc,
  });
  parser.setWikiFollow((target) => {
    void paperDoc.followWiki(target);
  });
  const filename = bindFilenameBar(
    requiredElement("filename"),
    (name) => paperDoc.rename(name),
    requiredElement<HTMLInputElement>("filename-peek"),
  );
  filename.setPath(paperDoc.path());
  filename.setScroller(view.getHost().layoutElement);
  paperDoc.onSessionChange(() => {
    filename.setPath(paperDoc.path());
  });
  view.onHostChange(() => {
    filename.setScroller(view.getHost().layoutElement);
  });
  view.onLayoutChange(() => {
    filename.sync();
  });
  const palette = bindPalette(
    requiredElement("palette"),
    requiredElement("palette-query"),
    requiredElement("palette-results"),
  );
  const quickOpen = (): void => {
    if (paperDoc.projectRoot() === null) {
      return;
    }
    void paperDoc.listFiles().then((files) => {
      palette.open({
        placeholder: "Datei suchen",
        load: (query) =>
          fuzzyMatch(files, query).map((path) => ({
            id: path,
            title: path,
          })),
        onPick: (item) => {
          void paperDoc.openProjectFile(item.id);
        },
      });
    });
  };
  const findInProject = (): void => {
    if (paperDoc.projectRoot() === null) {
      return;
    }
    palette.open({
      placeholder: "Im Projekt suchen",
      load: async (query) => {
        const hits = await paperDoc.search(query);
        return hits.map((hit) => ({
          id: `${hit.path}:${hit.line}`,
          title: `${hit.path}:${hit.line}`,
          detail: hit.text.trim(),
        }));
      },
      onPick: (item) => {
        const split = item.id.lastIndexOf(":");
        const path = item.id.slice(0, split);
        const line = Number(item.id.slice(split + 1));
        void paperDoc.openProjectFile(path, line);
      },
    });
  };
  void bindAppMenu(view, parser, highlight, paragraphNav, paperDoc, {
    quickOpen,
    findInProject,
  }, settings);
  bindWindowChrome(document.documentElement, requiredElement("traffic-lights"), {
    reveal: [requiredElement("filename-peek")],
    onChange: () => {
      filename.sync();
    },
  });
  bindTrafficLights({
    close: requiredElement("window-close"),
    minimize: requiredElement("window-minimize"),
    zoom: requiredElement("window-zoom"),
  });
  bindTitleDoubleClick(requiredElement("title-drag"));
  bindFullscreenClass(requiredElement("paper"));
});
