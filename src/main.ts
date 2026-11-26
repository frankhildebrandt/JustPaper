import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/400-italic.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/courier-prime/700-italic.css";
import "./paper.css";
import "./markdown.css";
import "./chrome.css";
import { bindAppMenu } from "./appMenu";
import { bindDocument } from "./document";
import { extractFrontmatterTags } from "./frontmatterTags";
import { bindFilenameBar } from "./filenameBar";
import { fuzzyMatch } from "./fuzzyMatch";
import { bindHighlightMode } from "./highlightMode";
import { bindLinkHelper, type LinkHelperItem } from "./linkHelper";
import { bindPalette } from "./palette";
import { bindParagraphNav } from "./paragraphNav";
import { bindParserMode, parserModeForPath } from "./parserMode";
import { documentDir } from "./markdown/imageSrc";
import {
  completedWikiLink,
  openWikiQuery,
  wikiInsertTarget,
} from "./openWikiQuery";
import { bindProjectCommands } from "./projectCommands";
import { bindSettings } from "./settings";
import { bindViewMode, textareaLayoutHost } from "./viewMode";
import {
  applyChromePlatform,
  bindFullscreenClass,
  bindMaximizeClass,
  bindTitleDoubleClick,
  bindTrafficLights,
  bindWindowChrome,
} from "./windowChrome";

const LINK_HELPER_LIMIT = 10;
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
    onWheel: parser.onWheel,
  });
  let syncLinkHelper = (): void => undefined;
  const settings = bindSettings(document.documentElement, {
    fontSize: (size) => {
      view.setFontSize(size);
    },
    viewMode: (mode) => {
      view.setViewMode(mode);
    },
    parserMode: (mode) => {
      parser.setParserMode(mode);
      syncLinkHelper();
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
    typstFeatures: (features) => {
      parser.setTypstFeatures(features);
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
  parser.setIncludeFollow((target) => {
    void paperDoc.followTypstInclude(target);
  });
  const applyAssetBase = (): void => {
    parser.setAssetBase(documentDir(paperDoc.path()), paperDoc.projectRoot());
  };
  applyAssetBase();
  const filename = bindFilenameBar(
    {
      row: requiredElement("filename-flow-row"),
      input: requiredElement<HTMLInputElement>("filename"),
      tags: requiredElement("filename-tags"),
    },
    (name) => paperDoc.rename(name),
    {
      row: requiredElement("filename-peek-row"),
      input: requiredElement<HTMLInputElement>("filename-peek"),
      tags: requiredElement("filename-peek-tags"),
    },
    (heightPx) => {
      view.setFilenameHeight(heightPx);
    },
  );
  const syncFilename = (): void => {
    filename.setPath(paperDoc.path());
    filename.setTags(extractFrontmatterTags(parser.getDocument()));
  };
  syncFilename();
  filename.setScroller(view.getHost().layoutElement);
  parser.onChange(() => {
    filename.setTags(extractFrontmatterTags(parser.getDocument()));
  });
  let projectFiles: string[] | null = null;
  let linkHelperFrom: number | undefined;
  let linkHelperActive = 0;
  let linkHelperRequest = 0;
  let linkHelperQuery: string | undefined;
  let linkHelperDismissedFrom: number | undefined;
  const pickLinkHelper = (item: LinkHelperItem): void => {
    if (linkHelperFrom === undefined) {
      return;
    }
    const from = linkHelperFrom;
    const to = parser.getCaretOffset();
    linkHelper.hide();
    linkHelperFrom = undefined;
    linkHelperDismissedFrom = undefined;
    parser.replaceRange(
      from,
      to,
      completedWikiLink(wikiInsertTarget(item.id)),
    );
  };
  const linkHelper = bindLinkHelper(
    requiredElement("link-helper"),
    requiredElement("link-helper-results"),
    pickLinkHelper,
  );
  const paperEl = requiredElement("paper");
  const markdownEl = requiredElement("markdown");
  const anchorFromCaret = (): { left: number; top: number } => {
    const paperBox = paperEl.getBoundingClientRect();
    const box = parser.caretScreenBox();
    if (box) {
      return {
        left: box.left - paperBox.left,
        top: box.bottom - paperBox.top + 4,
      };
    }
    const host = markdownEl.getBoundingClientRect();
    return {
      left: Math.max(12, host.left - paperBox.left + 24),
      top: Math.max(12, host.top - paperBox.top + 48),
    };
  };
  const syncLinkHelperBody = (): void => {
    if (
      parser.getParserMode() !== "markdownEdit" ||
      paperDoc.projectRoot() === null ||
      !parser.isSelectionEmpty()
    ) {
      linkHelper.hide();
      linkHelperFrom = undefined;
      linkHelperDismissedFrom = undefined;
      return;
    }
    const source = parser.getDocument();
    const caret = parser.getCaretOffset();
    const open = openWikiQuery(source, caret);
    if (!open) {
      linkHelper.hide();
      linkHelperFrom = undefined;
      linkHelperDismissedFrom = undefined;
      return;
    }
    if (linkHelperDismissedFrom === open.from) {
      linkHelper.hide();
      linkHelperFrom = open.from;
      return;
    }
    if (linkHelperFrom !== open.from || linkHelperQuery !== open.query) {
      linkHelperActive = 0;
    }
    linkHelperFrom = open.from;
    linkHelperQuery = open.query;
    const request = ++linkHelperRequest;
    const query = open.query;
    const apply = (files: string[]): void => {
      if (request !== linkHelperRequest || linkHelperFrom !== open.from) {
        return;
      }
      const paths = fuzzyMatch(files, query).slice(0, LINK_HELPER_LIMIT);
      linkHelper.show({
        items: paths.map((path) => ({ id: path, title: path })),
        active: linkHelperActive,
        anchor: anchorFromCaret(),
      });
    };
    if (projectFiles !== null) {
      apply(projectFiles);
      return;
    }
    void paperDoc.listFiles().then(
      (files) => {
        projectFiles = files;
        apply(files);
      },
      () => {
        projectFiles = [];
        apply([]);
      },
    );
  };
  let syncFrame = 0;
  syncLinkHelper = (): void => {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(syncLinkHelperBody);
  };
  parser.setLinkHelperKeys((key: string): boolean => {
    if (!linkHelper.isOpen()) {
      return false;
    }
    if (key === "Escape") {
      linkHelperDismissedFrom = linkHelperFrom;
      linkHelper.hide();
      return true;
    }
    if (key === "ArrowDown") {
      linkHelperActive = linkHelper.setActive(linkHelperActive + 1);
      return true;
    }
    if (key === "ArrowUp") {
      linkHelperActive = linkHelper.setActive(linkHelperActive - 1);
      return true;
    }
    if (key === "Enter") {
      const item = linkHelper.activeItem();
      if (!item) {
        return false;
      }
      pickLinkHelper(item);
      return true;
    }
    return false;
  });
  paperDoc.onSessionChange(() => {
    syncFilename();
    applyAssetBase();
    projectFiles = null;
    syncLinkHelper();
    const nextMode = parserModeForPath(
      paperDoc.path(),
      parser.getParserMode(),
    );
    if (nextMode !== parser.getParserMode()) {
      settings.setParserMode(nextMode);
    }
  });
  parser.onCaretOrDoc(syncLinkHelper);
  parser.onScroll(syncLinkHelper);
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
  const projectCommands = bindProjectCommands(paperDoc, parser, palette);
  void bindAppMenu(
    view,
    parser,
    highlight,
    paragraphNav,
    paperDoc,
    projectCommands,
    settings,
  );
  applyChromePlatform();
  bindWindowChrome(document.documentElement, requiredElement("window-chrome"), {
    reveal: [requiredElement("filename-peek-row")],
    onChange: () => {
      filename.sync();
    },
  });
  bindTrafficLights({
    close: requiredElement("window-close"),
    minimize: requiredElement("window-minimize"),
    zoom: requiredElement("window-zoom"),
  });
  bindMaximizeClass(requiredElement("window-zoom"));
  bindTitleDoubleClick(requiredElement("title-drag"));
  bindFullscreenClass(requiredElement("paper"));
});
