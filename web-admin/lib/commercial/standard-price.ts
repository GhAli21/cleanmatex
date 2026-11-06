/**
 * Standard price resolution (ADR-060 §5 step 1–2, PLAN.md §7, §8.1 step 1).
 *
 * Why: today's SQL `get_product_price` folds the list `discount_percent` into
 * the price, and Edit then applied it again (PF-03). Here the list price and
 * its discount come back separately; the discount becomes one line discount
 * (source `PRICE_LIST`) in P4-03, so it is applied exactly once.
 *
 * Pure: the loader passes every candidate list row; nothing is fetched here.
 */
import { PRICE_SOURCES, type PriceSourceCode } from '@/lib/constants/commercial';
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from './errors';
import { ZERO, toMoney, type Money, type MoneyInput } from './money';

/** The list type every tenant prices from when no customer list applies. */
export const STANDARD_PRICE_LIST_TYPE = 'standard';

/** One price-list item row with its list header, as the loader reads it. */
export interface PriceListCandidate {
  priceListId: string;
  priceListItemId: string;
  /** `org_price_lists_mst.price_list_type`, e.g. `standard`, `b2b`, `vip`. */
  listType: string;
  /** Higher wins; NULL counts as 0 (the column default). */
  listPriority: number | null;
  /** `YYYY-MM-DD`; NULL means open-ended. */
  effectiveFrom: string | null;
  effectiveTo: string | null;
  listActive: boolean;
  itemActive: boolean;
  unitPrice: MoneyInput;
  /** Percent 0–100; NULL means none. */
  discountPercent: MoneyInput | null;
  /** NULL counts as 1 (the column default). */
  minQuantity: number | null;
  maxQuantity: number | null;
}

/** Everything needed to price one row at standard speed. */
export interface StandardPriceInput {
  quantity: number;
  /** Business date in the tenant's time zone, `YYYY-MM-DD`. */
  businessDate: string;
  /** The customer's list type (`b2b`, `vip`), or null / `standard` for none. */
  customerListType: string | null;
  candidates: readonly PriceListCandidate[];
  /** `org_product_data_mst.default_sell_price`; null for a product with no price. */
  productDefaultPrice: MoneyInput | null;
}

/** The resolved standard price, before any speed premium or discount. */
export interface StandardPriceResult {
  unitPrice: Money;
  source: Exclude<PriceSourceCode, 'MANUAL'>;
  priceListId: string | null;
  priceListItemId: string | null;
  /** The list row's discount, returned for P4-03 to apply once as a line discount. */
  priceListDiscountPercent: Money;
}

/** Thrown when neither a list row nor a product default prices the row. */
export class PriceNotResolvedError extends CommercialRuleError {
  constructor() {
    super(COMMERCIAL_ERROR_CODES.PRICE_NOT_RESOLVED, 'No price list row or product default price applies to this row.');
    this.name = 'PriceNotResolvedError';
  }
}

const isEligible = (row: PriceListCandidate, listType: string, quantity: number, date: string): boolean =>
  row.listActive
  && row.itemActive
  && row.listType === listType
  && (row.effectiveFrom == null || row.effectiveFrom <= date)
  && (row.effectiveTo == null || row.effectiveTo >= date)
  && (row.minQuantity ?? 1) <= quantity
  && (row.maxQuantity == null || row.maxQuantity >= quantity);

// Same order as get_product_price (priority, then the deepest quantity tier),
// plus the item id so equal rows always resolve the same way.
const compareCandidates = (a: PriceListCandidate, b: PriceListCandidate): number =>
  (b.listPriority ?? 0) - (a.listPriority ?? 0)
  || (b.minQuantity ?? 1) - (a.minQuantity ?? 1)
  || a.priceListItemId.localeCompare(b.priceListItemId);

/**
 * Resolves the standard unit price: the customer list, then the standard
 * list, then the product default (ADR-060 §5 step 1).
 * @param input quantity, business date, customer list type, candidate rows, product default
 * @returns the unit price, its source and the list discount kept separate
 * @throws PriceNotResolvedError when nothing prices the row
 * @throws Error on a discount outside 0–100 or a non-positive quantity
 * @example
 * resolveStandardPrice({ quantity: 1, businessDate: '2026-10-24', customerListType: null,
 *   candidates: [], productDefaultPrice: '1.500' }).unitPrice.toString(); // '1.5'
 */
export function resolveStandardPrice(input: StandardPriceInput): StandardPriceResult {
  const { quantity, businessDate, candidates } = input;
  if (!(quantity > 0)) throw new Error(`Quantity must be positive: ${quantity}`);

  const customerType = input.customerListType && input.customerListType !== STANDARD_PRICE_LIST_TYPE
    ? input.customerListType
    : null;
  const tiers: { listType: string; source: StandardPriceResult['source'] }[] = [
    ...(customerType ? [{ listType: customerType, source: PRICE_SOURCES.CUSTOMER_PRICE }] : []),
    { listType: STANDARD_PRICE_LIST_TYPE, source: PRICE_SOURCES.PRICE_LIST },
  ];

  for (const tier of tiers) {
    const match = candidates
      .filter((row) => isEligible(row, tier.listType, quantity, businessDate))
      .sort(compareCandidates)[0];
    if (match) {
      const discount = match.discountPercent == null ? ZERO : toMoney(match.discountPercent);
      if (discount.isNegative() || discount.greaterThan(100)) {
        throw new Error(`Price list discount must be 0–100: ${discount.toString()}`);
      }
      return {
        unitPrice: toMoney(match.unitPrice),
        source: tier.source,
        priceListId: match.priceListId,
        priceListItemId: match.priceListItemId,
        priceListDiscountPercent: discount,
      };
    }
  }

  if (input.productDefaultPrice == null) throw new PriceNotResolvedError();
  return {
    unitPrice: toMoney(input.productDefaultPrice),
    source: PRICE_SOURCES.PRODUCT_DEFAULT,
    priceListId: null,
    priceListItemId: null,
    priceListDiscountPercent: ZERO,
  };
}
