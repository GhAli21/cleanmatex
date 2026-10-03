import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { FinanceTenderScope } from '@/lib/constants/pos-session';

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

/**
 * Tender scope of a finance write from the payment method codes it takes (B1): any cash-family
 * method makes it `CASH`, any other method `NON_CASH`, no method `NONE`.
 * @param methodCodes payment method codes of the write's tender legs
 * @returns the scope used to decide whether a POS session is mandatory
 * @example financeTenderScopeOf(['CARD', 'CASH']) // 'CASH'
 */
export function financeTenderScopeOf(methodCodes: ReadonlyArray<string | null | undefined>): FinanceTenderScope {
  if (methodCodes.some((code) => isCashFamilyMethod(code))) return 'CASH';
  return methodCodes.some((code) => String(code ?? '').trim() !== '') ? 'NON_CASH' : 'NONE';
}
