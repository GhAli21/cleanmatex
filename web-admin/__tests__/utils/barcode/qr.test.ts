/**
 * HFC P4: staff QR SVG (bwip-js, EC level M) has the requested size, a square viewBox and a path;
 * empty and non-ASCII values are refused.
 */
import bwipjs from 'bwip-js/browser';
import { isQrEncodable, renderQrSvg } from '@/lib/utils/barcode/qr';

describe('renderQrSvg', () => {
  it('renders a square SVG at the requested size', () => {
    const svg = renderQrSvg('CMX1:ORD:ORD-260101-0001', { size: 120 });
    expect(svg).toMatch(/^<svg width="120" height="120" shape-rendering="crispEdges" /);
    const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    expect(vb && vb[1]).toBe(vb && vb[2]);
    expect(svg).toContain('<path');
    expect(renderQrSvg('CMX1:PEC:X')).toContain('width="96"');
  });

  it('encodes the exact payload with EC level M', () => {
    const spy = jest.spyOn(bwipjs, 'toSVG');
    renderQrSvg('CMX1:PEC:ORD-260101-0001-1-2');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ bcid: 'qrcode', text: 'CMX1:PEC:ORD-260101-0001-1-2', eclevel: 'M' }));
    spy.mockRestore();
  });

  it('refuses empty, too long and non-ASCII values', () => {
    expect(isQrEncodable('')).toBe(false);
    expect(isQrEncodable('x'.repeat(257))).toBe(false);
    expect(() => renderQrSvg('طلب')).toThrow();
  });
});
