/** Turns a purchase tax refusal into the user's language for the ERP-Lite form actions. */
import 'server-only';

import { getTranslations } from 'next-intl/server';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from '@/lib/commercial/errors';

const PURCHASE_TAX_CODES = new Set<string>([
  COMMERCIAL_ERROR_CODES.NO_TAX_RULE,
  COMMERCIAL_ERROR_CODES.TAX_RULE_AMBIGUOUS,
  COMMERCIAL_ERROR_CODES.TAX_CODE_VERSION_MISSING,
  COMMERCIAL_ERROR_CODES.TAX_CODE_UNSUPPORTED,
  COMMERCIAL_ERROR_CODES.PURCHASE_TAX_MISMATCH,
  COMMERCIAL_ERROR_CODES.TAX_CLASS_INVALID,
  COMMERCIAL_ERROR_CODES.TAX_CURRENCY_UNSUPPORTED,
  COMMERCIAL_ERROR_CODES.FX_RATE_NOT_FOUND,
  COMMERCIAL_ERROR_CODES.PETTY_CASH_FX_UNSUPPORTED,
]);

/**
 * The translated message of a purchase tax refusal.
 * @param error - Whatever the service threw
 * @returns The message in the user's locale; null when it is not a tax refusal
 * @example const message = (await purchaseTaxErrorMessage(error)) ?? 'expense-create-failed';
 */
export async function purchaseTaxErrorMessage(error: unknown): Promise<string | null> {
  if (!(error instanceof CommercialRuleError) || !PURCHASE_TAX_CODES.has(error.code)) return null;
  const t = await getTranslations('erpLite.common.tax.errors');
  return t(error.code, { ...error.details });
}
