/**
 * Business-rule errors raised by the commercial calculator.
 *
 * Why: callers (quote service, Create, Edit) must tell a rule the user can fix
 * (a discount larger than the line) from a programming error. Each code maps
 * to an EN/AR message in the API layer; the calculator never formats text.
 */

/** Stable codes the API layer maps to user messages. */
export const COMMERCIAL_ERROR_CODES = {
  /** Neither a list row nor a product default prices the row. */
  PRICE_NOT_RESOLVED: 'PRICE_NOT_RESOLVED',
  /** Line discounts add up to more than the line gross (PLAN.md §8.3). */
  LINE_DISCOUNT_EXCEEDS_GROSS: 'LINE_DISCOUNT_EXCEEDS_GROSS',
  /** Order discounts add up to more than the lines they apply to. */
  DOCUMENT_DISCOUNT_EXCEEDS_BASE: 'DOCUMENT_DISCOUNT_EXCEEDS_BASE',
  /** An allocated order-discount share would exceed a line's net (gross-basis allocation). */
  DOCUMENT_DISCOUNT_EXCEEDS_LINE: 'DOCUMENT_DISCOUNT_EXCEEDS_LINE',
  /** The net unit price falls below `min_sell_price` without an override (L23). */
  PRICE_BELOW_MINIMUM: 'PRICE_BELOW_MINIMUM',
  /** A gift card was passed as a discount; it is settlement (PLAN.md §6.4). */
  GIFT_CARD_NOT_ADJUSTMENT: 'GIFT_CARD_NOT_ADJUSTMENT',
  /** A malformed adjustment or modifier (bad rate, negative or over-precise amount). */
  INVALID_ADJUSTMENT: 'INVALID_ADJUSTMENT',
  /** A piece discount or speed on a line priced on the item (ITEM level, or the PIECE fallback). */
  PIECE_PRICING_UNAVAILABLE: 'PIECE_PRICING_UNAVAILABLE',
  /** Tax is on and no tax rule matches this line (never a silent zero; ADR-061). */
  NO_TAX_RULE: 'NO_TAX_RULE',
  /** Two equally specific rules match this line. */
  TAX_RULE_AMBIGUOUS: 'TAX_RULE_AMBIGUOUS',
  /** A rule names a tax code with no version in force on the order date. */
  TAX_CODE_VERSION_MISSING: 'TAX_CODE_VERSION_MISSING',
  /** A rule names a fixed-amount or document-level code, which the order calculator does not support yet. */
  TAX_CODE_UNSUPPORTED: 'TAX_CODE_UNSUPPORTED',
  /** A purchase's entered tax differs from what its tax code gives by more than one minor unit. */
  PURCHASE_TAX_MISMATCH: 'PURCHASE_TAX_MISMATCH',
  /** A purchase line names an item tax class that is not an active purchase class. */
  TAX_CLASS_INVALID: 'TAX_CLASS_INVALID',
  /** Withholding tax applies, but its posting (T7) is not built yet; nothing is written. */
  /** A taxed purchase is in a currency other than the organization's (ERP-Lite records no exchange rate). */
  TAX_CURRENCY_UNSUPPORTED: 'TAX_CURRENCY_UNSUPPORTED',
  /** An output breaks a money invariant I1–I6 (PLAN.md §5.2); nothing is written. */
  COMMERCIAL_INVARIANT_FAILED: 'COMMERCIAL_INVARIANT_FAILED',
} as const;
/** Derived union of the calculator's business-rule codes. */
export type CommercialErrorCode = (typeof COMMERCIAL_ERROR_CODES)[keyof typeof COMMERCIAL_ERROR_CODES];

/** A business rule the input breaks; `details` carries the figures for the message. */
export class CommercialRuleError extends Error {
  readonly code: CommercialErrorCode;
  readonly details: Readonly<Record<string, string>>;

  constructor(code: CommercialErrorCode, message: string, details: Record<string, string> = {}) {
    super(message);
    this.name = 'CommercialRuleError';
    this.code = code;
    this.details = details;
  }
}
