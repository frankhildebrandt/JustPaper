export type FilenameFlowTop = {
  paddingTopPx: number;
  scrollTopPx: number;
  filenameHeightPx: number;
  gapPx: number;
};

/**
 * Returns the sheet-relative top for the filename glued above the first text line.
 */
export function filenameFlowTopPx({
  paddingTopPx,
  scrollTopPx,
  filenameHeightPx,
  gapPx,
}: FilenameFlowTop): number {
  return paddingTopPx - filenameHeightPx - gapPx - scrollTopPx;
}

/**
 * Returns whether the in-flow filename intersects the scroller viewport.
 */
export function filenameFlowVisible(
  flowTopPx: number,
  filenameHeightPx: number,
  viewportHeightPx: number,
): boolean {
  return flowTopPx < viewportHeightPx && flowTopPx + filenameHeightPx > 0;
}

/**
 * Returns whether the top-edge peek should replace the in-flow filename.
 */
export function filenameFlowHiddenByPeek(
  flowTopPx: number,
  peekVisible: boolean,
  peekHeightPx: number,
): boolean {
  return peekVisible && flowTopPx < peekHeightPx;
}

/**
 * Extra top padding so the filename fits above the first line in normal view.
 */
export function filenameReservePx(
  lineHeightPx: number,
  filenameHeightPx: number = lineHeightPx,
): number {
  return filenameHeightPx + lineHeightPx * 0.5;
}
