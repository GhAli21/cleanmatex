/**
 * New Order cart quote (Line-Level P5-03, PLAN.md §10.1 "Commercial quote", C12).
 *
 * Why: the cart and the summary rail show only server figures. They come from
 * the same checkout quote the payment modal and submit use, so the cart can
 * never disagree with what is stored (BF-19, D33). The client does no money math.
 */
import type { TaxPricingMode } from '@/lib/constants/order-financial';

/** One cart line as the calculator priced it; `index` is the cart position. */
export interface CartQuoteLine {
  index: number;
  /** `price_per_unit`: list price + speed premium, or the cashier price. */
  unitPrice: number;
  speedPremiumAmount: number;
  /** Line and piece preference extras inside the line. */
  includedModifierAmount: number;
  /** `total_price` */
  grossAmount: number;
  lineDiscountAmount: number;
  /** Each line discount, price-list first, then the cashier's (P5-03c). */
  discounts: CartQuoteLineDiscount[];
  /** This line's share of the order discounts (ALLOCATE_TO_LINES only; 0 under DOCUMENT_LEVEL). */
  orderDiscountAllocAmount: number;
  /** After line and order discounts. */
  netAmount: number;
  taxAmount: number;
  lineTotalAmount: number;
  readyByAt: string;
  /** Each piece's figures when the line is priced per piece (PIECE level, P9-01); else empty. */
  pieces: CartQuotePiece[];
}

/** One piece of a piece-priced line, in the order Create writes the pieces. */
export interface CartQuotePiece {
  unitPrice: number;
  grossAmount: number;
  lineDiscountAmount: number;
  netAmount: number;
}

/** One applied line discount; `source` mirrors `org_order_discounts_dtl.source_type`. */
export interface CartQuoteLineDiscount {
  source: string;
  /** The percent for a PERCENTAGE discount, else null. */
  rate: number | null;
  amount: number;
}

/** Header figures, the same values the payment modal receives. */
export interface CartQuoteTotals {
  /** The lines after their own discounts. */
  subtotal: number;
  /** Manual, rule and promo discounts on the order. */
  orderDiscountTotal: number;
  /** Order charges before their tax. */
  chargesTotal: number;
  taxTotal: number;
  /** Currency cash rounding (B17); signed. */
  roundingAdjustmentAmount: number;
  /** What the customer owes before settlement. */
  saleTotal: number;
}

/** Codes of the notes the cart shows when a figure needs explaining (rule #15). */
export const CART_QUOTE_DISCLOSURES = {
  /** An order-wide charge carries tax (L25). */
  ORDER_CHARGE_TAXED: 'ORDER_CHARGE_TAXED',
} as const;

/** A cart disclosure code. */
export type CartQuoteDisclosureCode = (typeof CART_QUOTE_DISCLOSURES)[keyof typeof CART_QUOTE_DISCLOSURES];

/** One disclosure, with the figure it explains. */
export interface CartQuoteDisclosure {
  code: CartQuoteDisclosureCode;
  amount: number;
}

/** The cart quote response body (`data`). */
export interface CartQuoteData {
  /** Echo of the request id, so a late answer to an older cart is ignored. */
  requestId: string;
  currencyCode: string;
  decimalPlaces: number;
  taxPricingMode: TaxPricingMode;
  totals: CartQuoteTotals;
  lines: CartQuoteLine[];
  /** The resolver's order ready-by (latest line), never the cashier's value. */
  readyByAt: string;
  disclosures: CartQuoteDisclosure[];
}
