/**
 * FX decimal math — exact, BigInt-only currency conversion (HQ plan 04 §7.4;
 * Tenant_Currency_FX plan 01 §7.1).
 *
 * Byte-identical logic to the HQ copy
 * (`cleanmatexsaas/platform-api/src/modules/currency-fx/services/fx-decimal.util.ts`)
 * so the two implementations cannot drift — both test suites verify the
 * shared golden-vectors fixture by checksum (plan §8). Never use JS `number`
 * for rates or amounts here.
 *
 * Conventions:
 *   - Amounts are integers in MINOR units of their currency (e.g. OMR 1.000 =
 *     1000, USD 1.00 = 100), passed as bigint.
 *   - Rates are decimal strings with ≤ 12 integer and ≤ 10 fraction digits,
 *     held as bigint scaled by 10^10 (RATE_SCALE).
 *   - Direction: target = source × rate (ADR-039).
 */

/** Rate precision: NUMERIC(22,10). */
export const RATE_DECIMALS = 10;
const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);

/** Accepted rate text: up to 12 integer digits and 10 fraction digits. */
export const RATE_PATTERN = /^\d{1,12}(\.\d{1,10})?$/;

/** Accepted minor-unit amount text: optional sign, digits only. */
export const AMOUNT_MINOR_PATTERN = /^-?\d{1,30}$/;

/**
 * The 7 rounding modes of sys_rounding_mode_cd (plan 02 decision 14).
 * UP/DOWN are relative to zero; CEILING/FLOOR are relative to ±∞ — they
 * differ for negative amounts (refunds).
 */
export const FX_ROUNDING_MODES = [
  'HALF_UP',
  'HALF_DOWN',
  'HALF_EVEN',
  'UP',
  'DOWN',
  'CEILING',
  'FLOOR',
] as const;
export type FxRoundingMode = (typeof FX_ROUNDING_MODES)[number];

/** Parse a rate string into bigint units of 10^-10. Throws on invalid or non-positive input. */
export function parseRate(rate: string): bigint {
  const text = rate.trim();
  if (!RATE_PATTERN.test(text)) {
    throw new RangeError(`Invalid rate "${rate}": expected up to 12 integer and 10 decimal digits`);
  }
  const [intPart, fracPart = ''] = text.split('.');
  const scaled = BigInt(intPart) * RATE_SCALE + BigInt(fracPart.padEnd(RATE_DECIMALS, '0'));
  if (scaled <= 0n) throw new RangeError('Rate must be greater than zero');
  return scaled;
}

/** Format a scaled rate back to a plain decimal string with trailing zeros trimmed. */
export function formatRate(scaled: bigint): string {
  const intPart = scaled / RATE_SCALE;
  const frac = (scaled % RATE_SCALE).toString().padStart(RATE_DECIMALS, '0').replace(/0+$/, '');
  return frac ? `${intPart}.${frac}` : intPart.toString();
}

/**
 * Invert a scaled rate at full precision: 1 / rate, rounded HALF_UP to 10 dp.
 * Used for INVERSE resolution — never derived from the stored display inverse.
 */
export function invertRate(scaled: bigint): bigint {
  if (scaled <= 0n) throw new RangeError('Rate must be greater than zero');
  return divideRounded(RATE_SCALE * RATE_SCALE, scaled, 'HALF_UP');
}

/**
 * Divide n by d (d > 0) and round the quotient to an integer with the given
 * mode. Sign-safe: the sign of n decides direction for UP/DOWN/HALF_*.
 */
export function divideRounded(n: bigint, d: bigint, mode: FxRoundingMode): bigint {
  if (d <= 0n) throw new RangeError('Divisor must be positive');
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const q = abs / d; // truncated toward zero
  const r = abs % d;
  if (r === 0n) return negative ? -q : q;

  const twice = r * 2n;
  let awayFromZero: boolean;
  switch (mode) {
    case 'UP':
      awayFromZero = true;
      break;
    case 'DOWN':
      awayFromZero = false;
      break;
    case 'CEILING':
      awayFromZero = !negative;
      break;
    case 'FLOOR':
      awayFromZero = negative;
      break;
    case 'HALF_UP':
      awayFromZero = twice >= d;
      break;
    case 'HALF_DOWN':
      awayFromZero = twice > d;
      break;
    case 'HALF_EVEN':
      awayFromZero = twice > d || (twice === d && q % 2n === 1n);
      break;
    default: {
      const exhaustive: never = mode;
      throw new RangeError(`Unknown rounding mode ${String(exhaustive)}`);
    }
  }
  const magnitude = awayFromZero ? q + 1n : q;
  return negative ? -magnitude : magnitude;
}

export interface ConvertMinorInput {
  /** Source amount in source minor units. */
  amountMinor: bigint;
  /** Rate scaled by 10^10 (see parseRate). */
  rateScaled: bigint;
  /** Source currency minor unit (sys_currency_cd.minor_unit). */
  fromMinorUnit: number;
  /** Target currency minor unit (sys_currency_cd.minor_unit). */
  toMinorUnit: number;
  mode: FxRoundingMode;
  /**
   * Snap the result to a multiple of this many target minor units (≥ 1).
   * Applied in the same single rounding step — never round-then-snap.
   */
  incrementMinor?: bigint;
}

export interface ConvertMinorResult {
  targetMinor: bigint;
  /** Exact target before rounding, as "numerator/denominator" in target minor units. */
  exactNumerator: bigint;
  exactDenominator: bigint;
}

/**
 * Convert a minor-unit amount between currencies with ONE rounding step:
 *   target_minor = round( amount_minor × rate × 10^toDp / (10^fromDp × 10^10) / inc ) × inc
 */
export function convertMinor(input: ConvertMinorInput): ConvertMinorResult {
  const { amountMinor, rateScaled, fromMinorUnit, toMinorUnit, mode } = input;
  const increment = input.incrementMinor ?? 1n;
  assertMinorUnit(fromMinorUnit);
  assertMinorUnit(toMinorUnit);
  if (increment < 1n) throw new RangeError('incrementMinor must be ≥ 1');
  if (rateScaled <= 0n) throw new RangeError('Rate must be greater than zero');

  const numerator = amountMinor * rateScaled * 10n ** BigInt(toMinorUnit);
  const denominator = 10n ** BigInt(fromMinorUnit) * RATE_SCALE;
  const units = divideRounded(numerator, denominator * increment, mode);
  return { targetMinor: units * increment, exactNumerator: numerator, exactDenominator: denominator };
}

/** Render a minor-unit amount as a major-unit decimal string (e.g. 3845, dp 3 → "3.845"). */
export function formatMinor(amountMinor: bigint, minorUnit: number): string {
  assertMinorUnit(minorUnit);
  const negative = amountMinor < 0n;
  const abs = negative ? -amountMinor : amountMinor;
  if (minorUnit === 0) return `${negative ? '-' : ''}${abs}`;
  const scale = 10n ** BigInt(minorUnit);
  const frac = (abs % scale).toString().padStart(minorUnit, '0');
  return `${negative ? '-' : ''}${abs / scale}.${frac}`;
}

/**
 * Render an exact fraction (in minor units) as a major-unit decimal string
 * truncated to `digits` fraction digits — for calculation traces only.
 */
export function formatExact(numerator: bigint, denominator: bigint, minorUnit: number, digits = 10): string {
  const negative = numerator < 0n !== denominator < 0n && numerator !== 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = (denominator < 0n ? -denominator : denominator) * 10n ** BigInt(minorUnit);
  const intPart = n / d;
  let rem = n % d;
  let frac = '';
  for (let i = 0; i < digits && rem !== 0n; i += 1) {
    rem *= 10n;
    frac += (rem / d).toString();
    rem %= d;
  }
  return `${negative ? '-' : ''}${intPart}${frac ? `.${frac}` : ''}`;
}

/** Parse a signed minor-unit amount string. */
export function parseAmountMinor(text: string): bigint {
  const trimmed = text.trim();
  if (!AMOUNT_MINOR_PATTERN.test(trimmed)) {
    throw new RangeError(`Invalid amount "${text}": expected an integer number of minor units`);
  }
  return BigInt(trimmed);
}

function assertMinorUnit(minorUnit: number): void {
  if (!Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 6) {
    throw new RangeError(`Invalid minor unit ${minorUnit}: expected an integer 0–6`);
  }
}
