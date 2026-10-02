/**
 * Currency Rounding (B17, extended by the HQ Currency Setup handoff §3.4)
 *
 * Applies an HQ-owned rounding rule (`sys_currency_rounding_rules_cf`,
 * migrations 0520-0522, context-scoped) to a grand total. Resolution is
 * `(currency, context)` -> fall back to `(currency, 'ACCOUNTING')` -> no-op
 * if still absent, per the handoff's resolution contract. Callers that don't
 * pass a context resolve ACCOUNTING, preserving this module's original B17
 * behavior exactly (the only live caller, `order-calculation.service.ts`,
 * has never passed one). Never invents a rounding behavior, matching the
 * B15 "resolve or zero, never assume" policy already applied to tax rates
 * and currency defaults.
 */

import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { CURRENCY_ROUNDING_MODES } from '@/lib/constants/order-financial';
import type { CurrencyRoundingMode } from '@/lib/constants/order-financial';
import type { RoundingContext } from '@/lib/constants/rounding-context';

/** Resolved rounding rule for one currency. */
export interface CurrencyRoundingRule {
  roundingMethod: CurrencyRoundingMode;
  roundingUnit: number;
}

/**
 * Decimal.js rounding mode for each unified mode (`sys_rounding_mode_cd`).
 * Decimal.js already defines every mode for negative values the way the
 * catalog does (UP/DOWN = away from / toward zero, CEILING/FLOOR = toward
 * +/- infinity, HALF_* = how an exact tie resolves), so refunds round
 * consistently with charges.
 */
const DECIMAL_ROUNDING: Record<CurrencyRoundingMode, Prisma.Decimal.Rounding> = {
  [CURRENCY_ROUNDING_MODES.HALF_UP]: Prisma.Decimal.ROUND_HALF_UP,
  [CURRENCY_ROUNDING_MODES.HALF_DOWN]: Prisma.Decimal.ROUND_HALF_DOWN,
  [CURRENCY_ROUNDING_MODES.HALF_EVEN]: Prisma.Decimal.ROUND_HALF_EVEN,
  [CURRENCY_ROUNDING_MODES.UP]: Prisma.Decimal.ROUND_UP,
  [CURRENCY_ROUNDING_MODES.DOWN]: Prisma.Decimal.ROUND_DOWN,
  [CURRENCY_ROUNDING_MODES.CEILING]: Prisma.Decimal.ROUND_CEIL,
  [CURRENCY_ROUNDING_MODES.FLOOR]: Prisma.Decimal.ROUND_FLOOR,
};

/** Money precision of every persisted amount (DECIMAL(19,4)). */
const MONEY_SCALE = 4;

/**
 * Round `value` to the nearest multiple of `increment` using `mode`.
 * No-op (returns `value` unchanged) when `increment` is not a usable
 * positive number — never invents a rounding behavior for a bad config row.
 * @param value
 * @param increment
 * @param mode
 */
export function roundToIncrement(
  value: number,
  increment: number,
  mode: CurrencyRoundingMode,
): number {
  if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) {
    return value;
  }
  // Decimal arithmetic from the shortest decimal text of each number, so
  // 2.0025 is exactly 2.0025 (not the nearest binary double) and a true tie
  // is a tie. No float multiplication or Number.EPSILON nudging anywhere.
  const step = new Prisma.Decimal(String(increment));
  const steps = new Prisma.Decimal(String(value)).div(step).toDecimalPlaces(0, DECIMAL_ROUNDING[mode]);
  return steps.times(step).toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Resolve the active rounding rule for `(currencyCode, context)`.
 * Resolution ladder (handoff §3.4): look up the exact context; if absent,
 * fall back to ACCOUNTING; if still absent, no-op. `context` defaults to
 * ACCOUNTING, preserving this function's original (pre-handoff) behavior
 * exactly for the one caller that has never passed one.
 *
 * Returns `null` when no active rule resolves, or when the resolved rule's
 * increment is absent/non-positive — callers must treat this as "no
 * rounding applies," not as an error. A currency with no rule row at all
 * still behaves correctly elsewhere (its own minor unit, no snapping); this
 * function's only caller additionally needs a concrete increment to call
 * `roundToIncrement` with, so a NULL increment resolves to "skip" here
 * rather than to "round to bare minor-unit precision" — order totals are
 * already at that precision by the time this runs.
 * @param currencyCode
 * @param context
 */
export async function resolveCurrencyRoundingRule(
  currencyCode: string,
  context: RoundingContext = 'ACCOUNTING',
): Promise<CurrencyRoundingRule | null> {
  const row =
    (await prisma.sys_currency_rounding_rules_cf.findFirst({
      where: { currency_code: currencyCode, rounding_context: context, is_active: true, rec_status: 1 },
      orderBy: { effective_from: 'desc' },
    })) ??
    (context !== 'ACCOUNTING'
      ? await prisma.sys_currency_rounding_rules_cf.findFirst({
          where: { currency_code: currencyCode, rounding_context: 'ACCOUNTING', is_active: true, rec_status: 1 },
          orderBy: { effective_from: 'desc' },
        })
      : null);
  if (!row || row.rounding_increment_minor == null) {
    return null;
  }
  const currency = await prisma.sys_currency_cd.findUnique({
    where: { code: currencyCode },
    select: { minor_unit: true },
  });
  const decimalPlaces = row.output_decimal_places ?? currency?.minor_unit ?? 2;
  const roundingUnit = new Prisma.Decimal(row.rounding_increment_minor).div(new Prisma.Decimal(10).pow(decimalPlaces)).toNumber();
  if (!Number.isFinite(roundingUnit) || roundingUnit <= 0) {
    return null;
  }
  const validModes = new Set<string>(Object.values(CURRENCY_ROUNDING_MODES));
  const roundingMethod = validModes.has(row.rounding_mode)
    ? (row.rounding_mode as CurrencyRoundingMode)
    : CURRENCY_ROUNDING_MODES.HALF_UP;
  return { roundingMethod, roundingUnit };
}
