/**
 * Golden-vector parity with the HQ FX module (plan 01 §8 contract).
 * `fx-golden-vectors.json` is a byte-identical copy of
 * `cleanmatexsaas/platform-api/src/modules/currency-fx/__tests__/fx-golden-vectors.json`.
 * The checksum assertion below catches silent drift between the two copies —
 * if this fails, re-copy the HQ file rather than editing the vectors here.
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  convertMinor,
  divideRounded,
  formatExact,
  formatMinor,
  formatRate,
  invertRate,
  parseAmountMinor,
  parseRate,
  type FxRoundingMode,
} from '@/lib/services/fx/fx-decimal';

interface GoldenVector {
  name: string;
  amountMinor: string;
  rate: string;
  fromMinorUnit: number;
  toMinorUnit: number;
  mode: FxRoundingMode;
  incrementMinor?: string;
  expectedMinor: string;
}

interface GoldenFile {
  version: number;
  vectors: GoldenVector[];
  inverse: { name: string; rate: string; expectedInverse: string }[];
}

/** Known-good SHA-256 of the canonical (HQ-owned) fixture — update only after re-copying from HQ. */
const EXPECTED_SHA256 = '19879eaba8c3ae7161d13af5910093a3794f3579f0394774f272433f5997056c';

const goldenPath = join(__dirname, 'fx-golden-vectors.json');
const goldenRaw = readFileSync(goldenPath, 'utf8');
const golden = JSON.parse(goldenRaw) as GoldenFile;

describe('fx-decimal — golden vectors (shared with the HQ app, byte-identical)', () => {
  it('fixture checksum matches the HQ-owned canonical file', () => {
    const sha = createHash('sha256').update(goldenRaw).digest('hex');
    expect(sha).toBe(EXPECTED_SHA256);
  });

  it('fixture is loaded and non-empty', () => {
    expect(golden.version).toBe(1);
    expect(golden.vectors.length).toBeGreaterThan(10);
  });

  it.each(golden.vectors.map((v) => [v.name, v] as const))('%s', (_name, v) => {
    const result = convertMinor({
      amountMinor: BigInt(v.amountMinor),
      rateScaled: parseRate(v.rate),
      fromMinorUnit: v.fromMinorUnit,
      toMinorUnit: v.toMinorUnit,
      mode: v.mode,
      incrementMinor: v.incrementMinor ? BigInt(v.incrementMinor) : undefined,
    });
    expect(result.targetMinor.toString()).toBe(v.expectedMinor);
  });

  it.each(golden.inverse.map((v) => [v.name, v] as const))('%s', (_name, v) => {
    expect(formatRate(invertRate(parseRate(v.rate)))).toBe(v.expectedInverse);
  });

  it('formatMinor renders major-unit decimals', () => {
    expect(formatMinor(3845n, 3)).toBe('3.845');
    expect(formatMinor(-3845n, 3)).toBe('-3.845');
    expect(formatMinor(1845n, 0)).toBe('1845');
  });

  it('formatExact truncates without rounding, for trace display only', () => {
    // numerator/denominator are in minor-unit terms (convertMinor's own convention):
    // 1 / (3 × 10^2) = 1/300 = 0.00333...
    expect(formatExact(1n, 3n, 2, 4)).toBe('0.0033');
    expect(formatExact(100n, 3n, 0, 4)).toBe('33.3333');
  });

  it('parseAmountMinor rejects non-integer text', () => {
    expect(() => parseAmountMinor('12.5')).toThrow(RangeError);
    expect(parseAmountMinor('-100')).toBe(-100n);
  });

  it('divideRounded rejects a non-positive divisor', () => {
    expect(() => divideRounded(10n, 0n, 'HALF_UP')).toThrow(RangeError);
  });

  it('convertMinor rejects a non-positive rate and an out-of-range minor unit', () => {
    expect(() =>
      convertMinor({ amountMinor: 100n, rateScaled: 0n, fromMinorUnit: 2, toMinorUnit: 2, mode: 'HALF_UP' })
    ).toThrow(RangeError);
    expect(() =>
      convertMinor({ amountMinor: 100n, rateScaled: 1n, fromMinorUnit: 7, toMinorUnit: 2, mode: 'HALF_UP' })
    ).toThrow(RangeError);
  });
});
