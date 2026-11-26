import { offsetAtLine } from "./caret";
import type { DocumentBinding } from "./document";
import { filterByQuery, fuzzyMatchNotes } from "./fuzzyMatch";
import type { PaletteBinding, PaletteItem } from "./palette";
import type { ParserModeBinding } from "./parserMode";
import { relativeFromRoot } from "./projectPath";
import { recentFileLabels } from "./recentFiles";
import { searchLines } from "./searchLines";
import {
  incomingTypstIncludes,
  outgoingTypstIncludes,
} from "./typst/includes";
import { incomingWikiLinks, outgoingWikiLinks } from "./wikiLink";

export const NO_PROJECT_TEXT =
  "Kein Projekt geöffnet – über „Datei › Ordner öffnen…“ einen Ordner wählen.";

export type ProjectCommands = {
  quickOpen: () => void;
  findInProject: () => void;
  jumpOutgoing: () => void;
  jumpIncoming: () => void;
  lastOpened: () => void;
  findInDocument: () => void;
};

type LineHit = { path: string; line: number; text: string };

/**
 * Builds a palette row for a `path:line` hit.
 */
export function lineHitItem(hit: LineHit): PaletteItem {
  const id = `${hit.path}:${hit.line}`;
  return { id, title: id, detail: hit.text.trim() };
}

/**
 * Splits a `path:line` palette id back into its project path and line number.
 */
export function parseLineHitId(id: string): { path: string; line: number } {
  const split = id.lastIndexOf(":");
  return { path: id.slice(0, split), line: Number(id.slice(split + 1)) };
}

/**
 * Runs `load` at most once per palette session, so typing filters cached data.
 */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= load();
    return pending;
  };
}

function searchable(item: PaletteItem): string {
  return `${item.title} ${item.detail ?? item.id}`;
}

/**
 * Wires the palette-based project commands (quick open, search, link jumps,
 * recents) to the open document and editor.
 */
export function bindProjectCommands(
  paperDoc: DocumentBinding,
  parser: ParserModeBinding,
  palette: PaletteBinding,
): ProjectCommands {
  const openLineHit = (item: PaletteItem): void => {
    const hit = parseLineHitId(item.id);
    void paperDoc.openProjectFile(hit.path, hit.line);
  };

  /**
   * Opens a project palette, or a hint row when no project is open.
   */
  const openProjectPalette = (
    placeholder: string,
    load: (query: string) => Promise<PaletteItem[]>,
    onPick: (item: PaletteItem) => void,
    emptyText: string | undefined = "Keine Treffer",
  ): void => {
    if (paperDoc.projectRoot() === null) {
      palette.open({
        placeholder,
        emptyText: NO_PROJECT_TEXT,
        load: () => [],
        onPick: () => undefined,
      });
      return;
    }
    palette.open({ placeholder, emptyText, load, onPick });
  };

  const currentRelative = (): string | undefined => {
    const root = paperDoc.projectRoot();
    const path = paperDoc.path();
    return root === null || path === null
      ? undefined
      : relativeFromRoot(root, path);
  };

  const quickOpen = (): void => {
    const notes = once(async () =>
      (await paperDoc.listFiles()).map((path) => ({
        path,
        tags: paperDoc.tagsFor(path),
      })),
    );
    openProjectPalette(
      "Datei suchen",
      async (query) =>
        fuzzyMatchNotes(await notes(), query).map((hit) => ({
          id: hit.path,
          title: hit.path,
          tags: hit.matchedTags,
        })),
      (item) => {
        void paperDoc.openProjectFile(item.id);
      },
    );
  };

  const findInProject = (): void => {
    openProjectPalette(
      "Im Projekt suchen",
      async (query) => (await paperDoc.search(query)).map(lineHitItem),
      openLineHit,
      undefined,
    );
  };

  const outgoingItems = async (): Promise<PaletteItem[]> => {
    const source = parser.getDocument();
    const from = currentRelative();
    if (paperDoc.typstMain() !== null) {
      return from === undefined
        ? []
        : outgoingTypstIncludes(source, from).map((link) => ({
            id: link.target,
            title: link.target,
            detail: link.path,
          }));
    }
    const [files, assets] = await Promise.all([
      paperDoc.listFiles(),
      paperDoc.listAssets(),
    ]);
    return outgoingWikiLinks(source, files, assets, from).map((link) => ({
      id: link.target,
      title: link.alias ?? link.target,
      detail: link.path,
    }));
  };

  const jumpOutgoing = (): void => {
    const typst = paperDoc.typstMain() !== null;
    const items = once(outgoingItems);
    openProjectPalette(
      typst ? "Includes im Dokument" : "Links im Dokument",
      async (query) => filterByQuery(await items(), query, searchable),
      (item) => {
        void (typst
          ? paperDoc.followTypstInclude(item.id)
          : paperDoc.followWiki(item.id));
      },
    );
  };

  const incomingItems = async (): Promise<PaletteItem[]> => {
    const current = currentRelative();
    if (current === undefined) {
      return [];
    }
    if (paperDoc.typstMain() !== null) {
      const notes = await paperDoc.readNotes();
      return incomingTypstIncludes(current, notes).map(lineHitItem);
    }
    const [files, notes] = await Promise.all([
      paperDoc.listFiles(),
      paperDoc.readNotes(),
    ]);
    return incomingWikiLinks(current, notes, files).map(lineHitItem);
  };

  const jumpIncoming = (): void => {
    const typst = paperDoc.typstMain() !== null;
    const items = once(incomingItems);
    openProjectPalette(
      typst ? "Eingehende Includes" : "Eingehende Links",
      async (query) => filterByQuery(await items(), query, searchable),
      openLineHit,
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
      emptyText: "Noch keine Dateien geöffnet",
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

  return {
    quickOpen,
    findInProject,
    jumpOutgoing,
    jumpIncoming,
    lastOpened,
    findInDocument,
  };
}
