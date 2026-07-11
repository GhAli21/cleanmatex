/**
 * Unit tests for the pure geometry helpers behind CmxKeypadPopover.
 * No DOM required — every case drives explicit sizes/viewport.
 */

import {
  clampToViewport,
  snapToEdges,
  defaultAnchorPosition,
  dockPosition,
  KEYPAD_MARGIN,
  KEYPAD_SNAP,
  type CmxKeypadSize,
  type CmxKeypadViewport,
} from '@ui/overlays/cmx-keypad-popover.geometry';

const SIZE: CmxKeypadSize = { width: 288, height: 320 };
const VP: CmxKeypadViewport = { width: 1024, height: 768 };
const M = KEYPAD_MARGIN;

describe('clampToViewport', () => {
  it('keeps an in-bounds position unchanged', () => {
    expect(clampToViewport({ left: 400, top: 300 }, SIZE, VP)).toEqual({ left: 400, top: 300 });
  });

  it('clamps a position off the top-left to the margin', () => {
    expect(clampToViewport({ left: -50, top: -80 }, SIZE, VP)).toEqual({ left: M, top: M });
  });

  it('clamps a position off the bottom-right to the max edge', () => {
    expect(clampToViewport({ left: 5000, top: 5000 }, SIZE, VP)).toEqual({
      left: VP.width - SIZE.width - M,
      top: VP.height - SIZE.height - M,
    });
  });

  it('never pushes past the origin when the popover is larger than the viewport', () => {
    const tiny: CmxKeypadViewport = { width: 200, height: 200 };
    const result = clampToViewport({ left: 999, top: 999 }, SIZE, tiny);
    expect(result).toEqual({ left: M, top: M });
  });
});

describe('snapToEdges', () => {
  it('snaps flush to the left margin when released near the left edge', () => {
    const near = { left: M + KEYPAD_SNAP - 1, top: 300 };
    expect(snapToEdges(near, SIZE, VP).left).toBe(M);
  });

  it('snaps flush to the right edge when released near the right', () => {
    const maxLeft = VP.width - SIZE.width - M;
    const near = { left: maxLeft - (KEYPAD_SNAP - 1), top: 300 };
    expect(snapToEdges(near, SIZE, VP).left).toBe(maxLeft);
  });

  it('snaps flush to the bottom edge when released near the bottom', () => {
    const maxTop = VP.height - SIZE.height - M;
    const near = { left: 400, top: maxTop - (KEYPAD_SNAP - 1) };
    expect(snapToEdges(near, SIZE, VP).top).toBe(maxTop);
  });

  it('leaves a centered position unsnapped', () => {
    const centered = { left: 400, top: 300 };
    expect(snapToEdges(centered, SIZE, VP)).toEqual(centered);
  });

  it('snaps both axes at once for a corner release', () => {
    const corner = { left: M + 3, top: M + 3 };
    expect(snapToEdges(corner, SIZE, VP)).toEqual({ left: M, top: M });
  });
});

describe('defaultAnchorPosition', () => {
  const anchor = { left: 600, right: 760, top: 120, bottom: 160 };

  it('aligns the right edge to the anchor in LTR', () => {
    const pos = defaultAnchorPosition(anchor, SIZE, VP, false);
    expect(pos.left).toBe(anchor.right - SIZE.width);
    expect(pos.top).toBeGreaterThan(anchor.bottom);
  });

  it('aligns the left edge to the anchor in RTL', () => {
    const pos = defaultAnchorPosition(anchor, SIZE, VP, true);
    expect(pos.left).toBe(anchor.left);
  });

  it('clamps the default placement into the viewport', () => {
    const edgeAnchor = { left: 1000, right: 1020, top: 700, bottom: 740 };
    const pos = defaultAnchorPosition(edgeAnchor, SIZE, VP, false);
    expect(pos.left).toBeLessThanOrEqual(VP.width - SIZE.width - M);
    expect(pos.top).toBeLessThanOrEqual(VP.height - SIZE.height - M);
    expect(pos.left).toBeGreaterThanOrEqual(M);
    expect(pos.top).toBeGreaterThanOrEqual(M);
  });
});

describe('dockPosition', () => {
  it('centers horizontally and pins to the bottom margin', () => {
    const pos = dockPosition(SIZE, VP);
    expect(pos.left).toBe((VP.width - SIZE.width) / 2);
    expect(pos.top).toBe(VP.height - SIZE.height - M);
  });
});
