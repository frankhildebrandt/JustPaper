import { describe, expect, it } from "vitest";
import { DEFAULT_MARKDOWN_FEATURES } from "./markdown/features";
import { DEFAULT_TYPST_FEATURES } from "./typst/features";
import {
  DEFAULT_SETTINGS,
  accentHex,
  applyTheme,
  checkedAppearanceItems,
  checkedFontSizeItems,
  checkedHighlightColorItems,
  fontSizeScale,
  parseSettings,
  serializeSettings,
} from "./settings";

describe("parseSettings", () => {
  it("returns defaults when nothing was stored", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("reads a stored settings object", () => {
    expect(
      parseSettings(
        JSON.stringify({
          fontSize: "s",
          highlightColor: "orange",
          appearance: "dark",
          viewMode: "normal",
          parserMode: "markdownEdit",
          highlightMode: "sentence",
        }),
      ),
    ).toEqual({
      fontSize: "s",
      highlightColor: "orange",
      appearance: "dark",
      viewMode: "normal",
      parserMode: "markdownEdit",
      highlightMode: "sentence",
      markdownFeatures: DEFAULT_MARKDOWN_FEATURES,
      markdownGraphic: false,
      typstFeatures: DEFAULT_TYPST_FEATURES,
    });
  });

  it("reads a typst parser mode", () => {
    expect(
      parseSettings(JSON.stringify({ parserMode: "typstView" })).parserMode,
    ).toBe("typstView");
  });

  it("reads the stored graphic markdown rendering flag", () => {
    expect(
      parseSettings(JSON.stringify({ markdownGraphic: true })).markdownGraphic,
    ).toBe(true);
  });

  it("reads stored typst feature flags and fills missing keys", () => {
    expect(
      parseSettings(
        JSON.stringify({
          typstFeatures: { math: false, unknown: true },
        }),
      ).typstFeatures,
    ).toEqual({
      ...DEFAULT_TYPST_FEATURES,
      math: false,
    });
  });

  it("reads stored markdown feature flags and fills missing keys", () => {
    expect(
      parseSettings(
        JSON.stringify({
          markdownFeatures: { table: false, unknown: true },
        }),
      ).markdownFeatures,
    ).toEqual({
      ...DEFAULT_MARKDOWN_FEATURES,
      table: false,
    });
  });

  it("fills defaults for missing or unknown fields", () => {
    expect(parseSettings("{}")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("not-json")).toEqual(DEFAULT_SETTINGS);
    expect(
      parseSettings(
        JSON.stringify({
          fontSize: "tiny",
          highlightColor: "yellow",
          appearance: "system",
          viewMode: "zen",
        }),
      ),
    ).toEqual(DEFAULT_SETTINGS);
  });
});

describe("serializeSettings", () => {
  it("round-trips through parseSettings", () => {
    const settings = {
      fontSize: "xl" as const,
      highlightColor: "pink" as const,
      appearance: "dark" as const,
      viewMode: "normal" as const,
      parserMode: "markdownView" as const,
      highlightMode: "headline" as const,
      markdownFeatures: {
        ...DEFAULT_MARKDOWN_FEATURES,
        image: false,
      },
      markdownGraphic: true,
      typstFeatures: {
        ...DEFAULT_TYPST_FEATURES,
        hash: false,
      },
    };
    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });
});

describe("fontSizeScale", () => {
  it("keeps L as the current auto-fit size", () => {
    expect(fontSizeScale("l")).toBe(1);
  });

  it("scales XS, S, M, and XL relative to L", () => {
    expect(fontSizeScale("xs")).toBe(0.45);
    expect(fontSizeScale("s")).toBe(0.58);
    expect(fontSizeScale("m")).toBe(0.73);
    expect(fontSizeScale("xl")).toBe(1.37);
  });
});

describe("accentHex", () => {
  it("uses the current filename blue in light mode", () => {
    expect(accentHex("blue", "light")).toBe("#1e3a8a");
  });

  it("uses chalk pastels in dark mode", () => {
    expect(accentHex("blue", "dark")).toBe("#8eb6d4");
    expect(accentHex("orange", "light")).toBe("#c2410c");
    expect(accentHex("orange", "dark")).toBe("#e09a5a");
  });
});

describe("applyTheme", () => {
  it("sets data-theme and data-accent on the root", () => {
    const attrs: Record<string, string> = {};
    const root = {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
    };

    applyTheme(root, {
      ...DEFAULT_SETTINGS,
      appearance: "dark",
      highlightColor: "green",
    });

    expect(attrs["data-theme"]).toBe("dark");
    expect(attrs["data-accent"]).toBe("green");
  });
});

describe("checkedFontSizeItems", () => {
  it("checks only L", () => {
    expect(checkedFontSizeItems("l")).toEqual({
      xs: false,
      s: false,
      m: false,
      l: true,
      xl: false,
    });
  });
});

describe("checkedHighlightColorItems", () => {
  it("checks only Blue", () => {
    expect(checkedHighlightColorItems("blue")).toEqual({
      blue: true,
      orange: false,
      red: false,
      pink: false,
      green: false,
    });
  });
});

describe("checkedAppearanceItems", () => {
  it("checks only Hell", () => {
    expect(checkedAppearanceItems("light")).toEqual({
      light: true,
      dark: false,
    });
  });
});
