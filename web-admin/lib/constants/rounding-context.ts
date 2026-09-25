/**
 * HQ Currency Setup handoff §3.2.3 — mirrors `sys_rounding_context_cd`
 * (migration 0520) exactly, DB-mirror rule. Consumed by
 * `resolveCurrencyRoundingRule` (lib/money/currency-rounding.ts) to pick
 * which policy row to resolve for a given rounding decision.
 */
export const ROUNDING_CONTEXT = {
  ACCOUNTING: 'ACCOUNTING',
  ORDER: 'ORDER',
  INVOICE: 'INVOICE',
  TAX: 'TAX',
  DISCOUNT: 'DISCOUNT',
  PAYMENT: 'PAYMENT',
  CASH_TENDER: 'CASH_TENDER',
  CASH_CHANGE: 'CASH_CHANGE',
  REFUND: 'REFUND',
  FX_CONVERSION: 'FX_CONVERSION',
  FX_REVALUATION: 'FX_REVALUATION',
  REPORTING: 'REPORTING',
  UNIT_PRICE: 'UNIT_PRICE',
  LOYALTY_REDEEM: 'LOYALTY_REDEEM',
  PAYOUT: 'PAYOUT',
} as const;

export type RoundingContext = (typeof ROUNDING_CONTEXT)[keyof typeof ROUNDING_CONTEXT];
