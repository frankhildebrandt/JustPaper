import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/400-italic.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/courier-prime/700-italic.css";
import "./paper.css";
import "./markdown.css";
import "./chrome.css";
import { bindAppMenu } from "./appMenu";
import { offsetAtLine } from "./caret";
import { bindDocument } from "./document";
import { bindFilenameBar } from "./filenameBar";
import { filterByQuery, fuzzyMatch } from "./fuzzyMatch";
import { bindHighlightMode } from "./highlightMode";
import { bindPalette } from "./palette";
import { bindParagraphNav } from "./paragraphNav";
import { bindParserMode } from "./parserMode";
import { documentDir } from "./markdown/imageSrc";
import { recentFileLabels } from "./recentFiles";
import { searchLines } from "./searchLines";
import { bindSettings } from "./settings";
import { bindViewMode, textareaLayoutHost } from "./viewMode";
import { incomingWikiLinks, outgoingWikiLinks } from "./wikiLink";
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

function relativeFromRoot(root: string, path: string): string | undefined {
  const prefix = `${root.replace(/\/+$/, "")}/`;
  if (!path.startsWith(prefix)) {
    return undefined;
  }
  return path.slice(prefix.length);
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
    markdownFeatures: (features) => {
      parser.setMarkdownFeatures(features);
    },
    markdownGraphic: (enabled) => {
      parser.setMarkdownGraphic(enabled);
    },
  });
  const paragraphNav = bindParagraphNav(requiredElement("paragraph-nav"), {
    getDocument: parser.getDocument,
    getCaretOffset: parser.getCaretOffset,
    setCaretOffset: parser.setCaretOffset,
    offsetAtClientPoint: parser.offsetAtClientPoint,
    scrollElement: parser.scrollElement,
    onScroll: parser.onScroll,
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
  const applyAssetBase = (): void => {
    parser.setAssetBase(documentDir(paperDoc.path()));
  };
  applyAssetBase();
  const filename = bindFilenameBar(
    requiredElement("filename"),
    (name) => paperDoc.rename(name),
    requiredElement<HTMLInputElement>("filename-peek"),
  );
  filename.setPath(paperDoc.path());
  filename.setScroller(view.getHost().layoutElement);
  paperDoc.onSessionChange(() => {
    filename.setPath(paperDoc.path());
    applyAssetBase();
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
  const jumpOutgoing = (): void => {
    if (paperDoc.projectRoot() === null) {
      return;
    }
    void paperDoc.listFiles().then((files) => {
      const links = outgoingWikiLinks(parser.getDocument(), files).map(
        (link) => ({
          id: link.target,
          title: link.alias ?? link.target,
          detail: link.path,
        }),
      );
      palette.open({
        placeholder: "Links im Dokument",
        load: (query) =>
          filterByQuery(
            links,
            query,
            (item) => `${item.title} ${item.detail ?? item.id}`,
          ),
        onPick: (item) => {
          void paperDoc.followWiki(item.id);
        },
      });
    });
  };
  const jumpIncoming = (): void => {
    const root = paperDoc.projectRoot();
    const path = paperDoc.path();
    if (root === null || path === null) {
      return;
    }
    const current = relativeFromRoot(root, path);
    if (current === undefined) {
      return;
    }
    void Promise.all([paperDoc.listFiles(), paperDoc.readNotes()]).then(
      ([files, notes]) => {
        const hits = incomingWikiLinks(current, notes, files).map((hit) => ({
          id: `${hit.path}:${hit.line}`,
          title: `${hit.path}:${hit.line}`,
          detail: hit.text.trim(),
        }));
        palette.open({
          placeholder: "Eingehende Links",
          load: (query) =>
            filterByQuery(
              hits,
              query,
              (item) => `${item.title} ${item.detail ?? ""}`,
            ),
          onPick: (item) => {
            const split = item.id.lastIndexOf(":");
            const relative = item.id.slice(0, split);
            const line = Number(item.id.slice(split + 1));
            void paperDoc.openProjectFile(relative, line);
          },
        });
      },
    );
  };
  const lastOpened = (): void => {
    const paths = paperDoc.recents();
    const labels = recentFileLabels(paths);
    const items = paths.map((path, index) => ({
      id: path,
      title: labels[index] ?? path,
    }));
    palette.open({
      placeholder: "Zuletzt geöffnet",
      load: (query) =>
        filterByQuery(items, query, (item) => `${item.title} ${item.id}`),
      onPick: (item) => {
        void paperDoc.openRecent(item.id);
      },
    });
  };
  const findInDocument = (): void => {
    palette.open({
      placeholder: "Im Dokument suchen",
      load: (query) =>
        searchLines(parser.getDocument(), query).map((hit) => ({
          id: String(hit.line),
          title: `Zeile ${hit.line}`,
          detail: hit.text.trim(),
        })),
      onPick: (item) => {
        parser.setCaretOffset(
          offsetAtLine(parser.getDocument(), Number(item.id)),
        );
        parser.revealCaret();
        parser.focus();
      },
    });
  };
  void bindAppMenu(view, parser, highlight, paragraphNav, paperDoc, {
    quickOpen,
    findInProject,
    jumpOutgoing,
    jumpIncoming,
    lastOpened,
    findInDocument,
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
