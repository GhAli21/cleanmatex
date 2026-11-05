/**
 * CODE128 barcode as SVG markup (Human-Friendly Codes P4, plan T4.1).
 * Uses bwip-js (pure JS, no canvas), so it works the same on the server, in the browser and in jest.
 * Imported as 'bwip-js/browser': that entry has types under moduleResolution "bundler" and runs in Node too.
 * The value is encoded as-is: hyphens are kept, so the printed bars scan back to the code shown on screen
 * (ORD-260101-0001, ORD-260101-0001-1, ORD-260101-0001-1-2).
 */
import bwipjs from 'bwip-js/browser';

export interface Code128Options {
  /** Width of the narrowest bar in px (CSS px; one module). Default 2. */
  moduleWidth?: number;
  /** Bar height in px. Default 48. */
  height?: number;
  /** Print the human-readable value under the bars (OCR-B). Default false: our templates print the code as text. */
  showText?: boolean;
}

/** Codes we print are printable ASCII (letters, digits, '-'); anything else is refused, not silently mangled. */
const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;
/** Quiet zone each side, in modules (CODE128 needs at least 10). */
const QUIET_ZONE_MODULES = 10;

export function isCode128Encodable(value: string): boolean {
  return value.length > 0 && value.length <= 80 && PRINTABLE_ASCII.test(value);
}

/**
 * Render `value` as a CODE128 SVG string with width/height in px (viewBox kept, so it scales with CSS).
 * Throws on an empty or non-printable value.
 */
export function renderCode128Svg(value: string, options: Code128Options = {}): string {
  const { moduleWidth = 2, height = 48, showText = false } = options;
  if (!isCode128Encodable(value)) {
    throw new Error('CODE128 value must be 1..80 printable ASCII characters');
  }
  const svg = bwipjs.toSVG({
    bcid: 'code128',
    text: value,
    scaleX: moduleWidth,
    scaleY: 1,
    // bwip-js heights are in millimetres at 72 dpi (1 px = 25.4/72 mm).
    height: (height * 25.4) / 72,
    paddingwidth: QUIET_ZONE_MODULES,
    includetext: showText,
    textxalign: 'center',
    backgroundcolor: 'FFFFFF',
  });
  const m = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  if (!m) return svg;
  return svg.replace('<svg ', `<svg width="${m[1]}" height="${m[2]}" shape-rendering="crispEdges" `);
}

/** Same SVG as a data URL (for <img src> and legacy callers). */
export function renderCode128DataUrl(value: string, options: Code128Options = {}): string {
  const svg = renderCode128Svg(value, options);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
