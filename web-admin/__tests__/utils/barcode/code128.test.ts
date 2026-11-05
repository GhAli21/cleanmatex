/**
 * CODE128 renderer (HFC P4, T4.1): real CODE128 bars (checked against bwip-js raw bar widths), hyphens kept.
 */
import bwipjs from 'bwip-js/browser';
import { isCode128Encodable, renderCode128DataUrl, renderCode128Svg } from '@/lib/utils/barcode/code128';

type Sbs = { sbs: number[]; txt?: unknown[][] };
const raw = (v: string) => (bwipjs.raw('code128', v, '') as unknown as Sbs[])[0];

// CODE128 bar/space patterns (module widths) for the values we check, from the ISO/IEC 15417 table.
const START_B = [2, 1, 1, 2, 1, 4];
const STOP = [2, 3, 3, 1, 1, 1, 2];
const HYPHEN = [1, 2, 2, 1, 3, 2]; // value 13 = '-' (code sets A and B)

function symbols(sbs: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i + 6 <= sbs.length - 7; i += 6) out.push(sbs.slice(i, i + 6));
  return out;
}

describe('renderCode128Svg', () => {
  it('returns an SVG with px size and one path of bars', () => {
    const svg = renderCode128Svg('ORD-260101-0001');
    expect(svg.startsWith('<svg width="')).toBe(true);
    expect(svg).toMatch(/height="49"/);
    expect(svg).toMatch(/viewBox="0 0 \d+ 49"/);
    expect(svg).toContain('<path');
    expect(svg).not.toContain('<text');
  });

  it('encodes a real CODE128 symbol: start B, the hyphens, checksum and stop', () => {
    const code = 'ORD-260101-0001-1';
    const r = raw(code);
    const sbs = r.sbs;
    expect(sbs.slice(0, 6)).toEqual(START_B);
    expect(sbs.slice(-7)).toEqual(STOP);
    // every symbol is 11 modules; total = 11 per symbol + 13 for the stop
    const total = sbs.reduce((a, b) => a + b, 0);
    expect((total - 13) % 11).toBe(0);
    const syms = symbols(sbs);
    syms.forEach((s) => expect(s.reduce((a, b) => a + b, 0)).toBe(11));
    // hyphens are encoded (3 of them), not dropped
    const hyphens = syms.filter((s) => s.join() === HYPHEN.join()).length;
    expect(hyphens).toBe(3);
  });

  it('draws the bars bwip-js computes (module width scales the bar positions)', () => {
    const one = renderCode128Svg('ORD-1', { moduleWidth: 1 });
    const two = renderCode128Svg('ORD-1', { moduleWidth: 2 });
    const w = (s: string) => Number(/viewBox="0 0 (\d+)/.exec(s)?.[1]);
    const modules = raw('ORD-1').sbs.reduce((a, b) => a + b, 0) + 20; // + quiet zones
    expect(w(one)).toBe(modules);
    expect(w(two)).toBe(modules * 2);
  });

  it('honours height and the optional human-readable text', () => {
    expect(renderCode128Svg('X1', { height: 72 })).toMatch(/height="73"/);
    const withText = renderCode128Svg('ORD-1', { showText: true });
    expect(withText).toMatch(/<path[^>]*fill="#000000"/);
  });

  it('refuses empty and non-printable values', () => {
    expect(() => renderCode128Svg('')).toThrow();
    expect(() => renderCode128Svg('طلب-1')).toThrow();
    expect(isCode128Encodable('ORD-1')).toBe(true);
    expect(isCode128Encodable('a\nb')).toBe(false);
  });

  it('builds a data URL', () => {
    expect(renderCode128DataUrl('ORD-1').startsWith('data:image/svg+xml;charset=utf-8,%3Csvg')).toBe(true);
  });
});
