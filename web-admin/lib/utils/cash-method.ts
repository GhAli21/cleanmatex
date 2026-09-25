import { PAYMENT_METHODS } from '@/lib/constants/payment';

/**
 * Cash-family payment method codes — the only methods whose settled amount is
 * physical cash in a drawer. Kept as a list so a future cash-equivalent code can
 * join without touching call sites. Values mirror DB `payment_method_code`.
 */
export const CASH_PAYMENT_METHOD_CODES: readonly string[] = [PAYMENT_METHODS.CASH];

const CASH_METHOD_SET = new Set(CASH_PAYMENT_METHOD_CODES.map((c) => c.toUpperCase()));

/**
 * True when the method code belongs to the cash family (case- and whitespace-insensitive).
 * @param code payment method code, possibly null
 * @returns whether the method moves physical cash
 * @example isCashFamilyMethod('CASH') // true
 */
export function isCashFamilyMethod(code: string | null | undefined): boolean {
  return CASH_METHOD_SET.has(String(code ?? '').trim().toUpperCase());
}
