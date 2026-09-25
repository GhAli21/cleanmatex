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

import { prisma } from '@/lib/db/prisma';
import { CURRENCY_ROUNDING_MODES } from '@/lib/constants/order-financial';
import type { CurrencyRoundingMode } from '@/lib/constants/order-financial';
import type { RoundingContext } from '@/lib/constants/rounding-context';

/** Resolved rounding rule for one currency. */
export interface CurrencyRoundingRule {
  roundingMethod: CurrencyRoundingMode;
  roundingUnit: number;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/**
 * All 7 unified modes (`sys_rounding_mode_cd`, handoff §3.2.5), each
 * correct for negative `raw` too — refunds must round consistently with
 * charges, not just happen to work because every caller today is positive.
 */
function applyRoundingMode(raw: number, mode: CurrencyRoundingMode): number {
  const sign = raw < 0 ? -1 : 1;
  const abs = Math.abs(raw);
  switch (mode) {
    case CURRENCY_ROUNDING_MODES.FLOOR:
      // Always toward -Infinity, regardless of sign.
      return Math.floor(raw);
    case CURRENCY_ROUNDING_MODES.CEILING:
      // Always toward +Infinity, regardless of sign.
      return Math.ceil(raw);
    case CURRENCY_ROUNDING_MODES.UP:
      // Always away from zero.
      return sign * Math.ceil(abs);
    case CURRENCY_ROUNDING_MODES.DOWN:
      // Always toward zero (truncate).
      return sign * Math.floor(abs);
    case CURRENCY_ROUNDING_MODES.HALF_DOWN: {
      // Ties toward zero.
      const fractional = abs - Math.floor(abs);
      return sign * (fractional > 0.5 ? Math.ceil(abs) : Math.floor(abs));
    }
    case CURRENCY_ROUNDING_MODES.HALF_EVEN: {
      // Ties to the nearest even integer (banker's rounding).
      const floor = Math.floor(abs);
      const fractional = abs - floor;
      if (fractional < 0.5) return sign * floor;
      if (fractional > 0.5) return sign * (floor + 1);
      return sign * (floor % 2 === 0 ? floor : floor + 1);
    }
    case CURRENCY_ROUNDING_MODES.HALF_UP:
    default:
      // Ties away from zero.
      return sign * Math.round(abs);
  }
}

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
  if (!Number.isFinite(increment) || increment <= 0) {
    return value;
  }
  const steps = value / increment;
  const roundedSteps = applyRoundingMode(steps, mode);
  return round4(roundedSteps * increment);
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
  const roundingUnit = row.rounding_increment_minor / 10 ** decimalPlaces;
  if (!Number.isFinite(roundingUnit) || roundingUnit <= 0) {
    return null;
  }
  const validModes = new Set<string>(Object.values(CURRENCY_ROUNDING_MODES));
  const roundingMethod = validModes.has(row.rounding_mode)
    ? (row.rounding_mode as CurrencyRoundingMode)
    : CURRENCY_ROUNDING_MODES.HALF_UP;
  return { roundingMethod, roundingUnit };
}
