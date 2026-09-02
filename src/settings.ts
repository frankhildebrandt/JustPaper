import type { HighlightMode } from "./highlightMode";
import {
  DEFAULT_MARKDOWN_FEATURES,
  MARKDOWN_FEATURES,
  type MarkdownFeature,
  type MarkdownFeatures,
  withMarkdownFeature,
} from "./markdown/features";
import type { ParserMode } from "./parserMode";
import {
  DEFAULT_TYPST_FEATURES,
  TYPST_FEATURES,
  type TypstFeature,
  type TypstFeatures,
  withTypstFeature,
} from "./typst/features";
import type { ViewMode } from "./viewMode";

export type FontSize = "xs" | "s" | "m" | "l" | "xl";
export type HighlightColor = "blue" | "orange" | "red" | "pink" | "green";
export type Appearance = "light" | "dark";

export type AppSettings = {
  fontSize: FontSize;
  highlightColor: HighlightColor;
  appearance: Appearance;
  viewMode: ViewMode;
  parserMode: ParserMode;
  highlightMode: HighlightMode;
  markdownFeatures: MarkdownFeatures;
  markdownGraphic: boolean;
  typstFeatures: TypstFeatures;
};

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: "l",
  highlightColor: "blue",
  appearance: "light",
  viewMode: "typewriter",
  parserMode: "plain",
  highlightMode: "none",
  markdownFeatures: { ...DEFAULT_MARKDOWN_FEATURES },
  markdownGraphic: false,
  typstFeatures: { ...DEFAULT_TYPST_FEATURES },
};

export const SETTINGS_STORAGE_KEY = "justpaper.settings";

const FONT_SIZE_SCALE: Record<FontSize, number> = {
  xs: 0.45,
  s: 0.58,
  m: 0.73,
  l: 1,
  xl: 1.37,
};

const ACCENT_HEX: Record<Appearance, Record<HighlightColor, string>> = {
  light: {
    blue: "#1e3a8a",
    orange: "#c2410c",
    red: "#b91c1c",
    pink: "#be185d",
    green: "#166534",
  },
  dark: {
    blue: "#8eb6d4",
    orange: "#e09a5a",
    red: "#e07a6a",
    pink: "#e09bb8",
    green: "#8fbf8a",
  },
};

export type ThemeRoot = {
  setAttribute: (name: string, value: string) => void;
};

/**
 * Reads persisted settings, falling back to defaults for missing or
 * corrupt storage.
 */
export function parseSettings(raw: string | null): AppSettings {
  if (raw === null) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") {
      return { ...DEFAULT_SETTINGS };
    }
    const record = parsed as Record<string, unknown>;
    return {
      fontSize: asFontSize(record.fontSize),
      highlightColor: asHighlightColor(record.highlightColor),
      appearance: asAppearance(record.appearance),
      viewMode: asViewMode(record.viewMode),
      parserMode: asParserMode(record.parserMode),
      highlightMode: asHighlightMode(record.highlightMode),
      markdownFeatures: asMarkdownFeatures(record.markdownFeatures),
      markdownGraphic: asBoolean(record.markdownGraphic, DEFAULT_SETTINGS.markdownGraphic),
      typstFeatures: asTypstFeatures(record.typstFeatures),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persists settings as a JSON string.
 */
export function serializeSettings(settings: AppSettings): string {
  return JSON.stringify(settings);
}

/**
 * Loads settings from `localStorage`, ignoring access errors.
 */
export function loadSettings(): AppSettings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Writes settings to `localStorage`.
 */
export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, serializeSettings(settings));
}

/**
 * Returns the auto-fit multiplier for a named font size. L is 1.
 */
export function fontSizeScale(size: FontSize): number {
  return FONT_SIZE_SCALE[size];
}

/**
 * Returns the accent hex for `color` in the given appearance.
 */
export function accentHex(color: HighlightColor, appearance: Appearance): string {
  return ACCENT_HEX[appearance][color];
}

/**
 * Applies appearance and accent as data attributes on the document root.
 */
export function applyTheme(root: ThemeRoot, settings: AppSettings): void {
  root.setAttribute("data-theme", settings.appearance);
  root.setAttribute("data-accent", settings.highlightColor);
}

/**
 * Returns which font-size menu items should be checked.
 */
export function checkedFontSizeItems(size: FontSize): Record<FontSize, boolean> {
  return {
    xs: size === "xs",
    s: size === "s",
    m: size === "m",
    l: size === "l",
    xl: size === "xl",
  };
}

/**
 * Returns which highlight-color menu items should be checked.
 */
export function checkedHighlightColorItems(
  color: HighlightColor,
): Record<HighlightColor, boolean> {
  return {
    blue: color === "blue",
    orange: color === "orange",
    red: color === "red",
    pink: color === "pink",
    green: color === "green",
  };
}

/**
 * Returns which appearance menu items should be checked.
 */
export function checkedAppearanceItems(
  appearance: Appearance,
): Record<Appearance, boolean> {
  return {
    light: appearance === "light",
    dark: appearance === "dark",
  };
}

function asFontSize(value: unknown): FontSize {
  return value === "xs" ||
    value === "s" ||
    value === "m" ||
    value === "l" ||
    value === "xl"
    ? value
    : DEFAULT_SETTINGS.fontSize;
}

function asHighlightColor(value: unknown): HighlightColor {
  return value === "blue" ||
    value === "orange" ||
    value === "red" ||
    value === "pink" ||
    value === "green"
    ? value
    : DEFAULT_SETTINGS.highlightColor;
}

function asAppearance(value: unknown): Appearance {
  return value === "light" || value === "dark"
    ? value
    : DEFAULT_SETTINGS.appearance;
}

function asViewMode(value: unknown): ViewMode {
  return value === "normal" || value === "typewriter"
    ? value
    : DEFAULT_SETTINGS.viewMode;
}

function asParserMode(value: unknown): ParserMode {
  return value === "plain" ||
    value === "markdownEdit" ||
    value === "markdownView" ||
    value === "typstEdit" ||
    value === "typstView"
    ? value
    : DEFAULT_SETTINGS.parserMode;
}

function asHighlightMode(value: unknown): HighlightMode {
  return value === "none" ||
    value === "paragraph" ||
    value === "sentence" ||
    value === "headline"
    ? value
    : DEFAULT_SETTINGS.highlightMode;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asMarkdownFeatures(value: unknown): MarkdownFeatures {
  if (value === null || typeof value !== "object") {
    return { ...DEFAULT_MARKDOWN_FEATURES };
  }
  const record = value as Record<string, unknown>;
  const features = { ...DEFAULT_MARKDOWN_FEATURES };
  for (const id of MARKDOWN_FEATURES) {
    if (typeof record[id] === "boolean") {
      features[id] = record[id];
    }
  }
  return features;
}

function asTypstFeatures(value: unknown): TypstFeatures {
  if (value === null || typeof value !== "object") {
    return { ...DEFAULT_TYPST_FEATURES };
  }
  const record = value as Record<string, unknown>;
  const features = { ...DEFAULT_TYPST_FEATURES };
  for (const id of TYPST_FEATURES) {
    if (typeof record[id] === "boolean") {
      features[id] = record[id];
    }
  }
  return features;
}

export type SettingsApply = {
  fontSize: (size: FontSize) => void;
  viewMode: (mode: ViewMode) => void;
  parserMode: (mode: ParserMode) => void;
  highlightMode: (mode: HighlightMode) => void;
  markdownFeatures: (features: MarkdownFeatures) => void;
  markdownGraphic: (enabled: boolean) => void;
  typstFeatures: (features: TypstFeatures) => void;
};

export type SettingsBinding = {
  get: () => AppSettings;
  setFontSize: (size: FontSize) => void;
  setHighlightColor: (color: HighlightColor) => void;
  setAppearance: (appearance: Appearance) => void;
  setViewMode: (mode: ViewMode) => void;
  setParserMode: (mode: ParserMode) => void;
  setHighlightMode: (mode: HighlightMode) => void;
  setMarkdownFeature: (id: MarkdownFeature, enabled: boolean) => void;
  setMarkdownGraphic: (enabled: boolean) => void;
  setTypstFeature: (id: TypstFeature, enabled: boolean) => void;
};

/**
 * Loads settings, applies them, and persists later changes.
 */
export function bindSettings(
  root: ThemeRoot,
  apply: SettingsApply,
): SettingsBinding {
  let current = loadSettings();
  applyTheme(root, current);
  apply.fontSize(current.fontSize);
  apply.viewMode(current.viewMode);
  apply.parserMode(current.parserMode);
  apply.highlightMode(current.highlightMode);
  apply.markdownFeatures(current.markdownFeatures);
  apply.markdownGraphic(current.markdownGraphic);
  apply.typstFeatures(current.typstFeatures);

  const commit = (next: AppSettings): void => {
    current = next;
    saveSettings(current);
    applyTheme(root, current);
  };

  return {
    get: () => current,
    setFontSize: (fontSize) => {
      commit({ ...current, fontSize });
      apply.fontSize(fontSize);
    },
    setHighlightColor: (highlightColor) => {
      commit({ ...current, highlightColor });
    },
    setAppearance: (appearance) => {
      commit({ ...current, appearance });
    },
    setViewMode: (viewMode) => {
      commit({ ...current, viewMode });
      apply.viewMode(viewMode);
    },
    setParserMode: (parserMode) => {
      commit({ ...current, parserMode });
      apply.parserMode(parserMode);
    },
    setHighlightMode: (highlightMode) => {
      commit({ ...current, highlightMode });
      apply.highlightMode(highlightMode);
    },
    setMarkdownFeature: (id, enabled) => {
      const markdownFeatures = withMarkdownFeature(
        current.markdownFeatures,
        id,
        enabled,
      );
      commit({ ...current, markdownFeatures });
      apply.markdownFeatures(markdownFeatures);
    },
    setMarkdownGraphic: (enabled) => {
      commit({ ...current, markdownGraphic: enabled });
      apply.markdownGraphic(enabled);
    },
    setTypstFeature: (id, enabled) => {
      const typstFeatures = withTypstFeature(
        current.typstFeatures,
        id,
        enabled,
      );
      commit({ ...current, typstFeatures });
      apply.typstFeatures(typstFeatures);
    },
  };
}
