import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/dpi";
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
import { markdownFeatureMenuItems } from "./markdown/menu";
import type { MarkdownFeature } from "./markdown/features";
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
import { isWindowsChrome, toggleNativeFullscreen } from "./windowChrome";
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

type MenuShortcut = {
  accelerator: string;
  action: () => void;
  enabled?: () => boolean;
};

/**
 * Returns whether a keyboard event matches a Tauri-style accelerator string.
 */
export function matchesAccelerator(
  event: KeyboardEvent,
  accelerator: string,
): boolean {
  const parts = accelerator.split("+").map((part) => part.trim());
  let cmdOrCtrl = false;
  let expectCtrl = false;
  let expectMeta = false;
  let expectShift = false;
  let expectAlt = false;
  let key = "";

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "cmdorctrl" || lower === "commandorcontrol") {
      cmdOrCtrl = true;
    } else if (lower === "cmd" || lower === "command" || lower === "super") {
      expectMeta = true;
    } else if (lower === "ctrl" || lower === "control") {
      expectCtrl = true;
    } else if (lower === "shift") {
      expectShift = true;
    } else if (lower === "alt" || lower === "option") {
      expectAlt = true;
    } else {
      key = part;
    }
  }

  if (cmdOrCtrl) {
    if (!(event.ctrlKey || event.metaKey)) {
      return false;
    }
  } else {
    if (event.ctrlKey !== expectCtrl) {
      return false;
    }
    if (event.metaKey !== expectMeta) {
      return false;
    }
  }
  if (event.shiftKey !== expectShift) {
    return false;
  }
  if (event.altKey !== expectAlt) {
    return false;
  }

  const expected = key.toUpperCase();
  if (
    expected.startsWith("F") &&
    expected.length > 1 &&
    !Number.isNaN(Number(expected.slice(1)))
  ) {
    return event.key.toUpperCase() === expected;
  }
  if (event.key.toUpperCase() === expected) {
    return true;
  }
  if (/^\d$/.test(expected)) {
    return event.code === `Digit${expected}` || event.code === `Numpad${expected}`;
  }
  if (/^[A-Z]$/.test(expected)) {
    return event.code === `Key${expected}`;
  }
  return false;
}

function rememberShortcut(
  shortcuts: MenuShortcut[],
  accelerator: string | undefined,
  action: (() => void) | undefined,
  enabled?: () => boolean,
): void {
  if (!accelerator || !action) {
    return;
  }
  shortcuts.push({ accelerator, action, enabled });
}

/**
 * Builds File menu items: New / Open / Save / Save As and recents.
 */
async function fileMenuItems(
  paperDoc: DocumentBinding,
  project: ProjectCommands,
  shortcuts: MenuShortcut[],
) {
  const recents = paperDoc.recents();
  const labels = recentFileLabels(recents);
  const inProject = paperDoc.projectRoot() !== null;
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
          recents.map((path, index) => {
            const accelerator = `CmdOrCtrl+${index + 1}`;
            const action = (): void => {
              void paperDoc.openRecent(path);
            };
            rememberShortcut(shortcuts, accelerator, action);
            return MenuItem.new({
              id: `file-recent-${index}`,
              text: labels[index] ?? path,
              accelerator,
              action,
            });
          }),
        );

  const newAction = (): void => {
    void paperDoc.newDocument();
  };
  const openAction = (): void => {
    void paperDoc.open();
  };
  const openFolderAction = (): void => {
    void paperDoc.openFolder();
  };
  const saveAction = (): void => {
    void paperDoc.save();
  };
  const saveAsAction = (): void => {
    void paperDoc.saveAs();
  };
  const quickOpenAction = (): void => {
    project.quickOpen();
  };
  const findInProjectAction = (): void => {
    project.findInProject();
  };
  const jumpOutgoingAction = (): void => {
    project.jumpOutgoing();
  };
  const jumpIncomingAction = (): void => {
    project.jumpIncoming();
  };
  const lastOpenedAction = (): void => {
    project.lastOpened();
  };

  rememberShortcut(shortcuts, "CmdOrCtrl+N", newAction);
  rememberShortcut(shortcuts, "CmdOrCtrl+O", openAction);
  rememberShortcut(shortcuts, "Shift+CmdOrCtrl+O", openFolderAction);
  rememberShortcut(shortcuts, "CmdOrCtrl+S", saveAction);
  rememberShortcut(shortcuts, "Shift+CmdOrCtrl+S", saveAsAction);
  rememberShortcut(shortcuts, "CmdOrCtrl+P", quickOpenAction, () => inProject);
  rememberShortcut(
    shortcuts,
    "CmdOrCtrl+Shift+P",
    findInProjectAction,
    () => inProject,
  );
  rememberShortcut(shortcuts, "CmdOrCtrl+J", jumpOutgoingAction, () => inProject);
  rememberShortcut(
    shortcuts,
    "Shift+CmdOrCtrl+J",
    jumpIncomingAction,
    () => inProject,
  );
  rememberShortcut(shortcuts, "CmdOrCtrl+E", lastOpenedAction);

  return [
    await MenuItem.new({
      id: "file-new",
      text: "Neu",
      accelerator: "CmdOrCtrl+N",
      action: newAction,
    }),
    await MenuItem.new({
      id: "file-open",
      text: "Open",
      accelerator: "CmdOrCtrl+O",
      action: openAction,
    }),
    await MenuItem.new({
      id: "file-open-folder",
      text: "Ordner öffnen...",
      accelerator: "Shift+CmdOrCtrl+O",
      action: openFolderAction,
    }),
    await MenuItem.new({
      id: "file-save",
      text: "Save",
      accelerator: "CmdOrCtrl+S",
      action: saveAction,
    }),
    await MenuItem.new({
      id: "file-save-as",
      text: "Save As...",
      accelerator: "Shift+CmdOrCtrl+S",
      action: saveAsAction,
    }),
    await PredefinedMenuItem.new({ item: "Separator" }),
    await MenuItem.new({
      id: "file-quick-open",
      text: "Datei suchen",
      accelerator: "CmdOrCtrl+P",
      enabled: inProject,
      action: quickOpenAction,
    }),
    await MenuItem.new({
      id: "file-find-in-project",
      text: "Im Projekt suchen",
      accelerator: "CmdOrCtrl+Shift+P",
      enabled: inProject,
      action: findInProjectAction,
    }),
    await MenuItem.new({
      id: "file-jump-outgoing",
      text: "Ausgehende Links",
      accelerator: "CmdOrCtrl+J",
      enabled: inProject,
      action: jumpOutgoingAction,
    }),
    await MenuItem.new({
      id: "file-jump-incoming",
      text: "Eingehende Links",
      accelerator: "Shift+CmdOrCtrl+J",
      enabled: inProject,
      action: jumpIncomingAction,
    }),
    await MenuItem.new({
      id: "file-last-opened",
      text: "Zuletzt geöffnet",
      accelerator: "CmdOrCtrl+E",
      action: lastOpenedAction,
    }),
    await PredefinedMenuItem.new({ item: "Separator" }),
    ...recentItems,
    await PredefinedMenuItem.new({ item: "Separator" }),
  ];
}

/**
 * Installs the native menu bar (macOS) or burger popup menu (Windows).
 */
export async function bindAppMenu(
  view: ViewModeBinding,
  parser: ParserModeBinding,
  highlight: HighlightModeBinding,
  paragraphNav: ParagraphNavBinding,
  paperDoc: DocumentBinding,
  project: ProjectCommands,
  settings: SettingsBinding,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const windows = isWindowsChrome();
  const menuButton = globalThis.document.getElementById("app-menu-button");
  let currentMenu: Menu | null = null;
  let shortcuts: MenuShortcut[] = [];

  let normalItem: CheckMenuItem;
  let typewriterItem: CheckMenuItem;
  let plainItem: CheckMenuItem;
  let markdownEditItem: CheckMenuItem;
  let markdownViewItem: CheckMenuItem;
  let typstEditItem: CheckMenuItem;
  let typstViewItem: CheckMenuItem;
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
  let featureItems = {} as Record<MarkdownFeature, CheckMenuItem>;
  let graphicItem: CheckMenuItem;

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
    void typstEditItem.setChecked(checked.typstEdit);
    void typstViewItem.setChecked(checked.typstView);
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

  const toggleMarkdownFeature = (id: MarkdownFeature): void => {
    const enabled = !settings.get().markdownFeatures[id];
    settings.setMarkdownFeature(id, enabled);
    void featureItems[id].setChecked(enabled);
  };

  const toggleMarkdownGraphic = (): void => {
    const enabled = !settings.get().markdownGraphic;
    settings.setMarkdownGraphic(enabled);
    void graphicItem.setChecked(enabled);
  };

  const install = async (): Promise<void> => {
    const nextShortcuts: MenuShortcut[] = [];
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
    typstEditItem = await CheckMenuItem.new({
      id: "parser-typst-edit",
      text: "Typst Edit",
      checked: parserChecked.typstEdit,
      action: () => {
        selectParser("typstEdit");
      },
    });
    typstViewItem = await CheckMenuItem.new({
      id: "parser-typst-view",
      text: "Typst View",
      checked: parserChecked.typstView,
      action: () => {
        selectParser("typstView");
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

    const fullscreenAccelerator = windows ? "F11" : "Ctrl+Cmd+F";
    const fullscreenAction = (): void => {
      void toggleNativeFullscreen();
    };
    rememberShortcut(nextShortcuts, fullscreenAccelerator, fullscreenAction);
    const fullscreenItem = await MenuItem.new({
      id: "view-fullscreen",
      text: "Vollbild",
      accelerator: fullscreenAccelerator,
      action: fullscreenAction,
    });

    const markdownMenu = await markdownFeatureMenuItems(
      settings.get().markdownFeatures,
      toggleMarkdownFeature,
    );
    featureItems = markdownMenu.byId;
    graphicItem = await CheckMenuItem.new({
      id: "markdown-graphic",
      text: "Grafisch",
      checked: settings.get().markdownGraphic,
      action: () => {
        toggleMarkdownGraphic();
      },
    });

    const appItems = windows
      ? [
          await PredefinedMenuItem.new({
            item: { About: { name: "JustPaper" } },
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Quit" }),
        ]
      : [
          await PredefinedMenuItem.new({
            item: { About: { name: "JustPaper" } },
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Hide" }),
          await PredefinedMenuItem.new({ item: "HideOthers" }),
          await PredefinedMenuItem.new({ item: "Quit" }),
        ];
    const appSubmenu = await Submenu.new({
      text: "JustPaper",
      items: appItems,
    });
    const fileSubmenu = await Submenu.new({
      text: "File",
      items: await fileMenuItems(paperDoc, project, nextShortcuts),
    });
    const findInDocumentAction = (): void => {
      project.findInDocument();
    };
    rememberShortcut(nextShortcuts, "CmdOrCtrl+F", findInDocumentAction);
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
          action: findInDocumentAction,
        }),
      ],
    });
    const markdownSubmenu = await Submenu.new({
      text: "Markdown",
      items: [
        graphicItem,
        await PredefinedMenuItem.new({ item: "Separator" }),
        ...markdownMenu.items,
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
        typstEditItem,
        typstViewItem,
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
      items: [
        appSubmenu,
        fileSubmenu,
        editSubmenu,
        markdownSubmenu,
        viewSubmenu,
      ],
    });
    shortcuts = nextShortcuts;
    currentMenu = menu;
    if (!windows) {
      await menu.setAsAppMenu();
    }
  };

  await install();

  const onMenuButton = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!currentMenu || !menuButton) {
      return;
    }
    const rect = menuButton.getBoundingClientRect();
    void currentMenu.popup(new LogicalPosition(rect.left, rect.bottom + 4));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    for (const shortcut of shortcuts) {
      if (!matchesAccelerator(event, shortcut.accelerator)) {
        continue;
      }
      if (shortcut.enabled && !shortcut.enabled()) {
        continue;
      }
      event.preventDefault();
      shortcut.action();
      return;
    }
  };

  if (windows) {
    menuButton?.addEventListener("click", onMenuButton);
    window.addEventListener("keydown", onKeyDown);
  }

  const stopRecents = paperDoc.onRecentsChange(() => {
    void install();
  });
  const stopSession = paperDoc.onSessionChange(() => {
    void install();
  });

  return () => {
    stopRecents();
    stopSession();
    if (windows) {
      menuButton?.removeEventListener("click", onMenuButton);
      window.removeEventListener("keydown", onKeyDown);
    }
  };
}
