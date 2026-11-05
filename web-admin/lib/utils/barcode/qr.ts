/**
 * QR code as SVG markup for printed staff labels (Human-Friendly Codes P4, plan T4.3).
 * Uses bwip-js like CODE128 (synchronous, no canvas), so a label renders in one pass for printing.
 * Error correction M (15%): survives a crease or a smudge on a garment tag while staying small.
 */
import bwipjs from 'bwip-js/browser';

export interface QrOptions {
  /** Printed size (width = height) in CSS px. Default 96. */
  size?: number;
}

/** Longest payload we print (CMX1:PEC:<piece code> is about 40). */
const MAX_QR_LENGTH = 256;

export function isQrEncodable(value: string): boolean {
  return value.length > 0 && value.length <= MAX_QR_LENGTH && /^[\x20-\x7E]+$/.test(value);
}

/** Render `value` as a square QR SVG string (viewBox kept, explicit size). Throws on an empty or non-ASCII value. */
export function renderQrSvg(value: string, options: QrOptions = {}): string {
  const { size = 96 } = options;
  if (!isQrEncodable(value)) {
    throw new Error('QR value must be 1..256 printable ASCII characters');
  }
  // eclevel is a BWIPP option bwip-js passes through; its RenderOptions type does not list it.
  const opts = {
    bcid: 'qrcode',
    text: value,
    eclevel: 'M',
    paddingwidth: 0,
    paddingheight: 0,
    backgroundcolor: 'FFFFFF',
  } as Parameters<typeof bwipjs.toSVG>[0];
  const svg = bwipjs.toSVG(opts);
  return svg.replace('<svg ', `<svg width="${size}" height="${size}" shape-rendering="crispEdges" `);
}
