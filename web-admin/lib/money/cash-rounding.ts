/**
 * Cash change rounding — pure, client-safe arithmetic (A6-1b, owner decision 2026-10-02).
 *
 * Only the CHANGE handed back for a cash tender is rounded; order totals, tax and
 * non-cash tenders are never touched. Cash cannot be handed out below the smallest
 * coin/note, so the exact change owed is rounded to the cash increment and the gap
 * is recorded explicitly (`adjustment`) so drawer expected cash equals counted cash.
 *
 * All arithmetic is done in integer minor units (no float drift); amounts are
 * converted once at the edge. No I/O here — policy resolution lives in
 * `lib/services/cash-change-rounding.service.ts`.
 */

import { CASH_CONTROL_CHANGE_BEARER } from '@/lib/constants/cash-control';
import type { CashControlChangeBearer } from '@/lib/constants/cash-control';
import { CURRENCY_ROUNDING_MODES } from '@/lib/constants/order-financial';
import type { CurrencyRoundingMode } from '@/lib/constants/order-financial';

/**
 * D16 — who absorbs the un-tenderable fraction of change, as a rounding mode:
 * BUSINESS rounds the change up (customer is never short-changed), CUSTOMER rounds
 * it down, NEAREST rounds half up.
 */
export const CHANGE_BEARER_ROUNDING_MODE: Record<CashControlChangeBearer, CurrencyRoundingMode> = {
  [CASH_CONTROL_CHANGE_BEARER.BUSINESS]: CURRENCY_ROUNDING_MODES.CEILING,
  [CASH_CONTROL_CHANGE_BEARER.CUSTOMER]: CURRENCY_ROUNDING_MODES.FLOOR,
  [CASH_CONTROL_CHANGE_BEARER.NEAREST]: CURRENCY_ROUNDING_MODES.HALF_UP,
};

/** Smallest amount treated as a real difference (half a minor unit at 4dp storage). */
const MONEY_EPSILON = 0.00005;

/** Outcome of rounding one cash change amount. Amounts are in major units. */
export interface CashChangeRounding {
  /** Change owed to the customer before rounding. */
  exactChange: number;
  /** Change actually handed out. Equals `exactChange` when no rounding applies. */
  roundedChange: number;
  /**
   * Effect of the rounding on the drawer: `exactChange − roundedChange`.
   * `> 0` — the drawer holds MORE than the exact amount (gain);
   * `< 0` — the drawer holds LESS (loss); `0` — nothing to record.
   */
  adjustment: number;
}

/**
 * Round a non-negative amount of minor units to a multiple of `incrementMinor`.
 * Returns `valueMinor` unchanged for a non-positive/invalid increment (never
 * invents a rounding behaviour for a bad configuration).
 * @param valueMinor amount in integer minor units, `>= 0`
 * @param incrementMinor rounding increment in integer minor units
 * @param mode unified rounding mode (`sys_rounding_mode_cd`)
 */
export function roundMinorToIncrement(
  valueMinor: number,
  incrementMinor: number,
  mode: CurrencyRoundingMode,
): number {
  if (!Number.isFinite(valueMinor) || valueMinor < 0) return valueMinor;
  if (!Number.isInteger(incrementMinor) || incrementMinor <= 0) return valueMinor;

  const quotient = Math.floor(valueMinor / incrementMinor);
  const remainder = valueMinor - quotient * incrementMinor;
  if (remainder === 0) return valueMinor;

  const twice = remainder * 2;
  let up: boolean;
  switch (mode) {
    case CURRENCY_ROUNDING_MODES.FLOOR:
    case CURRENCY_ROUNDING_MODES.DOWN:
      up = false;
      break;
    case CURRENCY_ROUNDING_MODES.CEILING:
    case CURRENCY_ROUNDING_MODES.UP:
      up = true;
      break;
    case CURRENCY_ROUNDING_MODES.HALF_DOWN:
      up = twice > incrementMinor;
      break;
    case CURRENCY_ROUNDING_MODES.HALF_EVEN:
      up = twice > incrementMinor || (twice === incrementMinor && quotient % 2 === 1);
      break;
    case CURRENCY_ROUNDING_MODES.HALF_UP:
    default:
      up = twice >= incrementMinor;
      break;
  }
  return (up ? quotient + 1 : quotient) * incrementMinor;
}

/**
 * Round the change owed for a cash tender.
 *
 * The rounded change never exceeds the cash the customer actually handed over
 * (`tendered`) — a cashier cannot give back more than was received.
 * @param input.exactChange change owed, major units, `>= 0`
 * @param input.maxChange upper bound for the rounded change (the tendered amount)
 * @param input.decimalPlaces currency minor-unit digits (`sys_currency_cd.minor_unit`)
 * @param input.incrementMinor cash increment in minor units; `null` = no rounding
 * @param input.mode rounding mode derived from the change-bearer policy
 */
export function computeCashChangeRounding(input: {
  exactChange: number;
  maxChange?: number;
  decimalPlaces: number;
  incrementMinor: number | null;
  mode: CurrencyRoundingMode;
}): CashChangeRounding {
  const { exactChange, maxChange, decimalPlaces, incrementMinor, mode } = input;
  const unrounded: CashChangeRounding = { exactChange, roundedChange: exactChange, adjustment: 0 };
  if (!Number.isFinite(exactChange) || exactChange <= MONEY_EPSILON) return unrounded;
  if (incrementMinor == null || !Number.isInteger(incrementMinor) || incrementMinor <= 1) return unrounded;

  const scale = 10 ** decimalPlaces;
  const exactMinor = Math.round(exactChange * scale);
  let roundedMinor = roundMinorToIncrement(exactMinor, incrementMinor, mode);

  if (maxChange != null && Number.isFinite(maxChange)) {
    const maxMinor = Math.round(maxChange * scale);
    // Never hand out more than was tendered: step down to the last allowed multiple.
    while (roundedMinor > maxMinor && roundedMinor >= incrementMinor) roundedMinor -= incrementMinor;
  }

  const roundedChange = roundedMinor / scale;
  const adjustmentMinor = exactMinor - roundedMinor;
  if (adjustmentMinor === 0) return unrounded;
  return { exactChange, roundedChange, adjustment: adjustmentMinor / scale };
}
