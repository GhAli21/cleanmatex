/**
 * Pure geometry helpers for {@link CmxKeypadPopover}.
 *
 * Extracted from the component so drag clamping, edge-snapping, and default
 * placement can be unit-tested without a DOM. Every function is side-effect
 * free and takes explicit sizes/viewport so tests can drive it deterministically.
 * @module ui/overlays
 */

/** A width/height pair in CSS pixels. */
export interface CmxKeypadSize {
  width: number;
  height: number;
}

/** A top-left position in CSS pixels (viewport coordinates). */
export interface CmxKeypadPoint {
  left: number;
  top: number;
}

/** Available viewport dimensions in CSS pixels. */
export interface CmxKeypadViewport {
  width: number;
  height: number;
}

/** Minimal rectangle shape (a subset of DOMRect) needed for anchor placement. */
export interface CmxKeypadAnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Gap kept between the popover and every viewport edge. */
export const KEYPAD_MARGIN = 14;

/** Distance from an edge within which the popover magnetically snaps flush. */
export const KEYPAD_SNAP = 22;

/** Gap between the anchor's bottom edge and the popover's default top. */
export const KEYPAD_ANCHOR_GAP = 10;

/**
 * Clamps a desired position so the popover stays fully inside the viewport,
 * keeping at least {@link KEYPAD_MARGIN} on every side. When the popover is
 * larger than the available space the low bound (margin) wins, so it can never
 * be pushed off the top-left origin.
 *
 * @param pos - Desired top-left position.
 * @param size - Popover size.
 * @param viewport - Viewport dimensions.
 * @param margin - Edge margin. Defaults to {@link KEYPAD_MARGIN}.
 * @returns The clamped position.
 */
export function clampToViewport(
  pos: CmxKeypadPoint,
  size: CmxKeypadSize,
  viewport: CmxKeypadViewport,
  margin = KEYPAD_MARGIN
): CmxKeypadPoint {
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const maxTop = Math.max(margin, viewport.height - size.height - margin);
  return {
    left: Math.min(Math.max(pos.left, margin), maxLeft),
    top: Math.min(Math.max(pos.top, margin), maxTop),
  };
}

/**
 * Clamps, then snaps the position flush to any edge it is released near
 * (within {@link KEYPAD_SNAP}). Left/right and top/bottom are evaluated
 * independently so a corner release snaps to both.
 *
 * @param pos - Desired top-left position.
 * @param size - Popover size.
 * @param viewport - Viewport dimensions.
 * @param snap - Snap threshold. Defaults to {@link KEYPAD_SNAP}.
 * @param margin - Edge margin. Defaults to {@link KEYPAD_MARGIN}.
 * @returns The clamped-and-snapped position.
 */
export function snapToEdges(
  pos: CmxKeypadPoint,
  size: CmxKeypadSize,
  viewport: CmxKeypadViewport,
  snap = KEYPAD_SNAP,
  margin = KEYPAD_MARGIN
): CmxKeypadPoint {
  const clamped = clampToViewport(pos, size, viewport, margin);
  let { left, top } = clamped;
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const maxTop = Math.max(margin, viewport.height - size.height - margin);

  if (left - margin <= snap) left = margin;
  else if (maxLeft - left <= snap) left = maxLeft;

  if (top - margin <= snap) top = margin;
  else if (maxTop - top <= snap) top = maxTop;

  return { left, top };
}

/**
 * Computes the first-open position relative to an anchor element. In LTR the
 * popover's right edge aligns to the anchor's right edge; in RTL its left edge
 * aligns to the anchor's left edge — so it opens toward the reading side. The
 * result is clamped into the viewport.
 *
 * @param anchor - Anchor rectangle (viewport coordinates).
 * @param size - Popover size.
 * @param viewport - Viewport dimensions.
 * @param isRTL - Whether the UI is right-to-left.
 * @param margin - Edge margin. Defaults to {@link KEYPAD_MARGIN}.
 * @param gap - Gap below the anchor. Defaults to {@link KEYPAD_ANCHOR_GAP}.
 * @returns The clamped default position.
 */
export function defaultAnchorPosition(
  anchor: CmxKeypadAnchorRect,
  size: CmxKeypadSize,
  viewport: CmxKeypadViewport,
  isRTL: boolean,
  margin = KEYPAD_MARGIN,
  gap = KEYPAD_ANCHOR_GAP
): CmxKeypadPoint {
  const left = isRTL ? anchor.left : anchor.right - size.width;
  const top = anchor.bottom + gap;
  return clampToViewport({ left, top }, size, viewport, margin);
}

/**
 * Computes the docked position: horizontally centered, flush to the bottom
 * margin. Used by the dock button and as the anchor-less fallback.
 *
 * @param size - Popover size.
 * @param viewport - Viewport dimensions.
 * @param margin - Edge margin. Defaults to {@link KEYPAD_MARGIN}.
 * @returns The clamped docked position.
 */
export function dockPosition(
  size: CmxKeypadSize,
  viewport: CmxKeypadViewport,
  margin = KEYPAD_MARGIN
): CmxKeypadPoint {
  return clampToViewport(
    {
      left: (viewport.width - size.width) / 2,
      top: viewport.height - size.height - margin,
    },
    size,
    viewport,
    margin
  );
}
