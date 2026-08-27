import type { HeadingLevel } from "./parse";

export type HeadingStyle = {
  gutter: string;
  hangCh: number;
  fontEm: number;
  lineHeight: number;
  marginBeforeEm: number;
  marginAfterEm: number;
};

const BODY_LINE_HEIGHT = 1.55;

const STYLES: Record<HeadingLevel, Omit<HeadingStyle, "gutter" | "hangCh" | "lineHeight">> = {
  1: { fontEm: 1.45, marginBeforeEm: 0.3, marginAfterEm: 0.1 },
  2: { fontEm: 1.3, marginBeforeEm: 0.25, marginAfterEm: 0.08 },
  3: { fontEm: 1.18, marginBeforeEm: 0.2, marginAfterEm: 0.08 },
  4: { fontEm: 1.1, marginBeforeEm: 0.15, marginAfterEm: 0.06 },
  5: { fontEm: 1.05, marginBeforeEm: 0.12, marginAfterEm: 0.05 },
  6: { fontEm: 1, marginBeforeEm: 0.12, marginAfterEm: 0.05 },
};

const LEVELS: HeadingLevel[] = [1, 2, 3, 4, 5, 6];

/**
 * Returns gutter marks and type scale for an ATX heading level.
 * Extra space is a small breath, not a blank line, so headings sit in the writing flow.
 */
export function headingStyle(level: HeadingLevel): HeadingStyle {
  const gutter = "#".repeat(level);
  return {
    gutter,
    hangCh: level + 1,
    lineHeight: BODY_LINE_HEIGHT / STYLES[level].fontEm,
    ...STYLES[level],
  };
}

/**
 * Writes heading type-scale CSS variables onto an element.
 */
export function applyHeadingCssVars(element: HTMLElement): void {
  for (const level of LEVELS) {
    const style = headingStyle(level);
    element.style.setProperty(`--md-h${level}-font`, `${style.fontEm}em`);
    element.style.setProperty(`--md-h${level}-line`, `${style.lineHeight}`);
    element.style.setProperty(`--md-h${level}-before`, `${style.marginBeforeEm}em`);
    element.style.setProperty(`--md-h${level}-after`, `${style.marginAfterEm}em`);
  }
}
