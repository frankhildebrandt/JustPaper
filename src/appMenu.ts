import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import type { DocumentBinding } from "./document";
import {
  checkedHighlightModeItems,
  type HighlightMode,
  type HighlightModeBinding,
} from "./highlightMode";
import {
  checkedParagraphNav,
  type ParagraphNavBinding,
} from "./paragraphNav";
import {
  checkedParserModeItems,
  type ParserMode,
  type ParserModeBinding,
} from "./parserMode";
import { recentFileLabels } from "./recentFiles";
import {
  checkedAppearanceItems,
  checkedFontSizeItems,
  checkedHighlightColorItems,
  type Appearance,
  type FontSize,
  type HighlightColor,
  type SettingsBinding,
} from "./settings";
import { toggleNativeFullscreen } from "./windowChrome";
import {
  checkedViewModeItems,
  type ViewMode,
  type ViewModeBinding,
} from "./viewMode";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export type ProjectCommands = {
  quickOpen: () => void;
  findInProject: () => void;
  jumpOutgoing: () => void;
  jumpIncoming: () => void;
  lastOpened: () => void;
  findInDocument: () => void;
};

/**
 * Builds File menu items: New / Open / Save / Save As and recents.
 */
async function fileMenuItems(
  document: DocumentBinding,
  project: ProjectCommands,
) {
  const recents = document.recents();
  const labels = recentFileLabels(recents);
  const inProject = document.projectRoot() !== null;
  const recentItems =
    recents.length === 0
      ? [
          await MenuItem.new({
            id: "file-recent-empty",
            text: "No Recent Files",
            enabled: false,
          }),
        ]
      : await Promise.all(
          recents.map((path, index) =>
            MenuItem.new({
              id: `file-recent-${index}`,
              text: labels[index] ?? path,
              accelerator: `CmdOrCtrl+${index + 1}`,
              action: () => {
                void document.openRecent(path);
              },
            }),
          ),
        );

  return [
    await MenuItem.new({
      id: "file-new",
      text: "Neu",
      accelerator: "CmdOrCtrl+N",
      action: () => {
        void document.newDocument();
      },
    }),
    await MenuItem.new({
      id: "file-open",
      text: "Open",
      accelerator: "CmdOrCtrl+O",
      action: () => {
        void document.open();
      },
    }),
    await MenuItem.new({
      id: "file-open-folder",
      text: "Ordner öffnen...",
      accelerator: "Shift+CmdOrCtrl+O",
      action: () => {
        void document.openFolder();
      },
    }),
    await MenuItem.new({
      id: "file-save",
      text: "Save",
      accelerator: "CmdOrCtrl+S",
      action: () => {
        void document.save();
      },
    }),
    await MenuItem.new({
      id: "file-save-as",
      text: "Save As...",
      accelerator: "Shift+CmdOrCtrl+S",
      action: () => {
        void document.saveAs();
      },
    }),
    await PredefinedMenuItem.new({ item: "Separator" }),
    await MenuItem.new({
      id: "file-quick-open",
      text: "Datei suchen",
      accelerator: "CmdOrCtrl+P",
      enabled: inProject,
      action: () => {
        project.quickOpen();
      },
    }),
    await MenuItem.new({
      id: "file-find-in-project",
      text: "Im Projekt suchen",
      accelerator: "CmdOrCtrl+Shift+P",
      enabled: inProject,
      action: () => {
        project.findInProject();
      },
    }),
    await MenuItem.new({
      id: "file-jump-outgoing",
      text: "Ausgehende Links",
      accelerator: "CmdOrCtrl+J",
      enabled: inProject,
      action: () => {
        project.jumpOutgoing();
      },
    }),
    await MenuItem.new({
      id: "file-jump-incoming",
      text: "Eingehende Links",
      accelerator: "Shift+CmdOrCtrl+J",
      enabled: inProject,
      action: () => {
        project.jumpIncoming();
      },
    }),
    await MenuItem.new({
      id: "file-last-opened",
      text: "Zuletzt geöffnet",
      accelerator: "CmdOrCtrl+E",
      action: () => {
        project.lastOpened();
      },
    }),
    await PredefinedMenuItem.new({ item: "Separator" }),
    ...recentItems,
    await PredefinedMenuItem.new({ item: "Separator" }),
  ];
}

/**
 * Installs the native menu bar, with file actions and view modes.
 */
export async function bindAppMenu(
  view: ViewModeBinding,
  parser: ParserModeBinding,
  highlight: HighlightModeBinding,
  paragraphNav: ParagraphNavBinding,
  document: DocumentBinding,
  project: ProjectCommands,
  settings: SettingsBinding,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  let normalItem: CheckMenuItem;
  let typewriterItem: CheckMenuItem;
  let plainItem: CheckMenuItem;
  let markdownEditItem: CheckMenuItem;
  let markdownViewItem: CheckMenuItem;
  let noneItem: CheckMenuItem;
  let paragraphItem: CheckMenuItem;
  let sentenceItem: CheckMenuItem;
  let headlineItem: CheckMenuItem;
  let paragraphNavItem: CheckMenuItem;
  let fontXsItem: CheckMenuItem;
  let fontSItem: CheckMenuItem;
  let fontMItem: CheckMenuItem;
  let fontLItem: CheckMenuItem;
  let fontXlItem: CheckMenuItem;
  let colorBlueItem: CheckMenuItem;
  let colorOrangeItem: CheckMenuItem;
  let colorRedItem: CheckMenuItem;
  let colorPinkItem: CheckMenuItem;
  let colorGreenItem: CheckMenuItem;
  let lightItem: CheckMenuItem;
  let darkItem: CheckMenuItem;

  const selectView = (mode: ViewMode): void => {
    settings.setViewMode(mode);
    const checked = checkedViewModeItems(mode);
    void normalItem.setChecked(checked.normal);
    void typewriterItem.setChecked(checked.typewriter);
  };

  const selectParser = (mode: ParserMode): void => {
    settings.setParserMode(mode);
    const checked = checkedParserModeItems(mode);
    void plainItem.setChecked(checked.plain);
    void markdownEditItem.setChecked(checked.markdownEdit);
    void markdownViewItem.setChecked(checked.markdownView);
  };

  const selectHighlight = (mode: HighlightMode): void => {
    settings.setHighlightMode(mode);
    const checked = checkedHighlightModeItems(mode);
    void noneItem.setChecked(checked.none);
    void paragraphItem.setChecked(checked.paragraph);
    void sentenceItem.setChecked(checked.sentence);
    void headlineItem.setChecked(checked.headline);
  };

  const selectFontSize = (size: FontSize): void => {
    settings.setFontSize(size);
    const checked = checkedFontSizeItems(size);
    void fontXsItem.setChecked(checked.xs);
    void fontSItem.setChecked(checked.s);
    void fontMItem.setChecked(checked.m);
    void fontLItem.setChecked(checked.l);
    void fontXlItem.setChecked(checked.xl);
  };

  const selectHighlightColor = (color: HighlightColor): void => {
    settings.setHighlightColor(color);
    const checked = checkedHighlightColorItems(color);
    void colorBlueItem.setChecked(checked.blue);
    void colorOrangeItem.setChecked(checked.orange);
    void colorRedItem.setChecked(checked.red);
    void colorPinkItem.setChecked(checked.pink);
    void colorGreenItem.setChecked(checked.green);
  };

  const selectAppearance = (appearance: Appearance): void => {
    settings.setAppearance(appearance);
    const checked = checkedAppearanceItems(appearance);
    void lightItem.setChecked(checked.light);
    void darkItem.setChecked(checked.dark);
  };

  const toggleParagraphNav = (): void => {
    const enabled = !paragraphNav.isEnabled();
    paragraphNav.setEnabled(enabled);
    void paragraphNavItem.setChecked(checkedParagraphNav(enabled).paragraphNav);
  };

  const install = async (): Promise<void> => {
    const viewChecked = checkedViewModeItems(view.getViewMode());
    const parserChecked = checkedParserModeItems(parser.getParserMode());
    const highlightChecked = checkedHighlightModeItems(
      highlight.getHighlightMode(),
    );

    normalItem = await CheckMenuItem.new({
      id: "view-normal",
      text: "Normal",
      checked: viewChecked.normal,
      action: () => {
        selectView("normal");
      },
    });
    typewriterItem = await CheckMenuItem.new({
      id: "view-typewriter",
      text: "Schreibmaschine",
      checked: viewChecked.typewriter,
      action: () => {
        selectView("typewriter");
      },
    });
    plainItem = await CheckMenuItem.new({
      id: "parser-plain",
      text: "Nur Text",
      checked: parserChecked.plain,
      action: () => {
        selectParser("plain");
      },
    });
    markdownEditItem = await CheckMenuItem.new({
      id: "parser-markdown-edit",
      text: "Markdown Edit",
      checked: parserChecked.markdownEdit,
      action: () => {
        selectParser("markdownEdit");
      },
    });
    markdownViewItem = await CheckMenuItem.new({
      id: "parser-markdown-view",
      text: "Markdown View",
      checked: parserChecked.markdownView,
      action: () => {
        selectParser("markdownView");
      },
    });
    noneItem = await CheckMenuItem.new({
      id: "highlight-none",
      text: "Kein Highlight",
      checked: highlightChecked.none,
      action: () => {
        selectHighlight("none");
      },
    });
    paragraphItem = await CheckMenuItem.new({
      id: "highlight-paragraph",
      text: "Absatz",
      checked: highlightChecked.paragraph,
      action: () => {
        selectHighlight("paragraph");
      },
    });
    sentenceItem = await CheckMenuItem.new({
      id: "highlight-sentence",
      text: "Satz",
      checked: highlightChecked.sentence,
      action: () => {
        selectHighlight("sentence");
      },
    });
    headlineItem = await CheckMenuItem.new({
      id: "highlight-headline",
      text: "Headline",
      checked: highlightChecked.headline,
      action: () => {
        selectHighlight("headline");
      },
    });
    paragraphNavItem = await CheckMenuItem.new({
      id: "view-paragraph-nav",
      text: "Absatzmarkierungen",
      checked: checkedParagraphNav(paragraphNav.isEnabled()).paragraphNav,
      action: () => {
        toggleParagraphNav();
      },
    });

    const current = settings.get();
    const fontChecked = checkedFontSizeItems(current.fontSize);
    const colorChecked = checkedHighlightColorItems(current.highlightColor);
    const appearanceChecked = checkedAppearanceItems(current.appearance);

    fontXsItem = await CheckMenuItem.new({
      id: "font-xs",
      text: "XS",
      checked: fontChecked.xs,
      action: () => {
        selectFontSize("xs");
      },
    });
    fontSItem = await CheckMenuItem.new({
      id: "font-s",
      text: "S",
      checked: fontChecked.s,
      action: () => {
        selectFontSize("s");
      },
    });
    fontMItem = await CheckMenuItem.new({
      id: "font-m",
      text: "M",
      checked: fontChecked.m,
      action: () => {
        selectFontSize("m");
      },
    });
    fontLItem = await CheckMenuItem.new({
      id: "font-l",
      text: "L",
      checked: fontChecked.l,
      action: () => {
        selectFontSize("l");
      },
    });
    fontXlItem = await CheckMenuItem.new({
      id: "font-xl",
      text: "XL",
      checked: fontChecked.xl,
      action: () => {
        selectFontSize("xl");
      },
    });
    colorBlueItem = await CheckMenuItem.new({
      id: "color-blue",
      text: "Blau",
      checked: colorChecked.blue,
      action: () => {
        selectHighlightColor("blue");
      },
    });
    colorOrangeItem = await CheckMenuItem.new({
      id: "color-orange",
      text: "Orange",
      checked: colorChecked.orange,
      action: () => {
        selectHighlightColor("orange");
      },
    });
    colorRedItem = await CheckMenuItem.new({
      id: "color-red",
      text: "Rot",
      checked: colorChecked.red,
      action: () => {
        selectHighlightColor("red");
      },
    });
    colorPinkItem = await CheckMenuItem.new({
      id: "color-pink",
      text: "Pink",
      checked: colorChecked.pink,
      action: () => {
        selectHighlightColor("pink");
      },
    });
    colorGreenItem = await CheckMenuItem.new({
      id: "color-green",
      text: "Grün",
      checked: colorChecked.green,
      action: () => {
        selectHighlightColor("green");
      },
    });
    lightItem = await CheckMenuItem.new({
      id: "appearance-light",
      text: "Hell",
      checked: appearanceChecked.light,
      action: () => {
        selectAppearance("light");
      },
    });
    darkItem = await CheckMenuItem.new({
      id: "appearance-dark",
      text: "Dunkel",
      checked: appearanceChecked.dark,
      action: () => {
        selectAppearance("dark");
      },
    });
    const fullscreenItem = await MenuItem.new({
      id: "view-fullscreen",
      text: "Vollbild",
      accelerator: "Ctrl+Cmd+F",
      action: () => {
        void toggleNativeFullscreen();
      },
    });

    const appSubmenu = await Submenu.new({
      text: "JustPaper",
      items: [
        await PredefinedMenuItem.new({ item: { About: { name: "JustPaper" } } }),
        await PredefinedMenuItem.new({ item: "Separator" }),
        await PredefinedMenuItem.new({ item: "Hide" }),
        await PredefinedMenuItem.new({ item: "HideOthers" }),
        await PredefinedMenuItem.new({ item: "Quit" }),
      ],
    });
    const fileSubmenu = await Submenu.new({
      text: "File",
      items: await fileMenuItems(document, project),
    });
    const editSubmenu = await Submenu.new({
      text: "Edit",
      items: [
        await PredefinedMenuItem.new({ item: "Undo" }),
        await PredefinedMenuItem.new({ item: "Redo" }),
        await PredefinedMenuItem.new({ item: "Separator" }),
        await PredefinedMenuItem.new({ item: "Cut" }),
        await PredefinedMenuItem.new({ item: "Copy" }),
        await PredefinedMenuItem.new({ item: "Paste" }),
        await PredefinedMenuItem.new({ item: "SelectAll" }),
        await PredefinedMenuItem.new({ item: "Separator" }),
        await MenuItem.new({
          id: "edit-find-in-document",
          text: "Im Dokument suchen",
          accelerator: "CmdOrCtrl+F",
          action: () => {
            project.findInDocument();
          },
        }),
      ],
    });
    const viewSubmenu = await Submenu.new({
      text: "View",
      items: [
        normalItem,
        typewriterItem,
        await PredefinedMenuItem.new({ item: "Separator" }),
        plainItem,
        markdownEditItem,
        markdownViewItem,
        await PredefinedMenuItem.new({ item: "Separator" }),
        noneItem,
        paragraphItem,
        sentenceItem,
        headlineItem,
        await PredefinedMenuItem.new({ item: "Separator" }),
        paragraphNavItem,
        await PredefinedMenuItem.new({ item: "Separator" }),
        fontXsItem,
        fontSItem,
        fontMItem,
        fontLItem,
        fontXlItem,
        await PredefinedMenuItem.new({ item: "Separator" }),
        colorBlueItem,
        colorOrangeItem,
        colorRedItem,
        colorPinkItem,
        colorGreenItem,
        await PredefinedMenuItem.new({ item: "Separator" }),
        lightItem,
        darkItem,
        await PredefinedMenuItem.new({ item: "Separator" }),
        fullscreenItem,
      ],
    });
    const menu = await Menu.new({
      items: [appSubmenu, fileSubmenu, editSubmenu, viewSubmenu],
    });
    await menu.setAsAppMenu();
  };

  await install();
  const stopRecents = document.onRecentsChange(() => {
    void install();
  });
  const stopSession = document.onSessionChange(() => {
    void install();
  });

  return () => {
    stopRecents();
    stopSession();
  };
}
