/**
 * Cart line grouping rules (Cart Line Grouping P2, docs/features/Order_Cart_Line_Grouping/DESIGN.md §4).
 * Pure functions: which line a tap adds to, which measured lines may take an article, and how a
 * measured line splits back into equal shares. Measures are compared and added as exact decimals.
 */
import { toMoney, type Money } from '@/lib/commercial/money';
import { UOM_DIMENSIONS } from '@/lib/constants/uom';
import type { LineKey, OrderItem, OrderItemMeasure } from './new-order-types';

/** Where a tapped catalog product goes. */
export type CartAddTarget = { kind: 'MERGE'; lineKey: LineKey } | { kind: 'NEW_LINE' };

/**
 * A line staff customised commercially (own price, discount or speed) is closed: a new piece must
 * not inherit a price chosen for other garments (CLAUDE.md rule 11). Line preferences don't close it.
 * @param line the cart line
 * @returns whether automatic merging may add to it
 */
export function isOpenLine(line: OrderItem): boolean {
  return line.priceOverride == null && !line.lineDiscount && line.serviceSpeed == null && !line.customItem;
}

/**
 * The add rule for a counted product (§4, R3–R5). Measured products go through the measure dialog instead.
 * @param items the cart lines, in cart order
 * @param productId the tapped catalog product
 * @returns the most recently added open line of that product, else a new line
 */
export function resolveCartAddTarget(items: readonly OrderItem[], productId: string): CartAddTarget {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const line = items[i];
    if (line.productId === productId && !line.uom && isOpenLine(line)) return { kind: 'MERGE', lineKey: line.lineKey };
  }
  return { kind: 'NEW_LINE' };
}

/** A measure as an exact decimal, or null when not entered or not a positive number. */
function measuredOf(measure: OrderItemMeasure | undefined): Money | null {
  const text = measure?.measuredQty?.trim();
  if (!text) return null;
  try {
    const value = toMoney(text);
    return value.isFinite() && value.greaterThan(0) ? value : null;
  } catch {
    return null;
  }
}

/** What identifies the article being added. */
export interface MeasuredArticle {
  productId: string;
  serviceCategoryCode: string | null | undefined;
  uomCode: string;
}

/**
 * Lines that may take one more article of the same measure (§4.1): same product and service category,
 * same unit (not AREA: one length × width per line), open, and every piece already has the entered
 * measure (entered × quantity = line measure, exact).
 * @param items the cart lines
 * @param article the product, category and unit being added
 * @param entered what staff measured for the new article
 * @returns the matching lines, in cart order
 */
export function findMatchingMeasuredLines(
  items: readonly OrderItem[],
  article: MeasuredArticle,
  entered: OrderItemMeasure,
): OrderItem[] {
  const value = measuredOf(entered);
  if (!value) return [];
  return items.filter((line) => {
    if (line.productId !== article.productId) return false;
    if ((line.serviceCategoryCode ?? null) !== (article.serviceCategoryCode ?? null)) return false;
    if (!line.uom || line.uom.code !== article.uomCode || line.uom.dimension === UOM_DIMENSIONS.AREA) return false;
    if (!isOpenLine(line) || line.quantity < 1) return false;
    const total = measuredOf(line.measure);
    return total != null && value.times(line.quantity).equals(total);
  });
}

/**
 * The line's measure after one more article: the line total plus the entered measure (exact).
 * @param line a measured, non-area line
 * @param entered the new article's measure
 * @returns the new line measure
 */
export function measureWithArticle(line: OrderItem, entered: OrderItemMeasure): OrderItemMeasure {
  const total = measuredOf(line.measure) ?? toMoney(0);
  const added = measuredOf(entered) ?? toMoney(0);
  return { measuredQty: total.plus(added).toString(), length: '', width: '' };
}

/**
 * One equal share of a measured line (§4.3): the line measure ÷ quantity, only when exact at the unit's decimals.
 * @param line the cart line
 * @returns the share as decimal text, or null when the line can't be split into equal shares
 */
export function equalMeasureShare(line: OrderItem): string | null {
  if (!line.uom || line.uom.dimension === UOM_DIMENSIONS.AREA || line.quantity < 2) return null;
  const total = measuredOf(line.measure);
  if (!total) return null;
  const share = total.dividedBy(line.quantity);
  if (share.decimalPlaces() > line.uom.qtyDecimals || !share.times(line.quantity).equals(total)) return null;
  return share.toString();
}

/**
 * The line's position among the lines of its product, when the product has more than one line (§5.5).
 * @param items the cart lines
 * @param lineKey the line
 * @returns 1-based line number, or null when the product has a single line
 */
export function productLineNumber(items: readonly OrderItem[], lineKey: LineKey): number | null {
  const line = items.find((item) => item.lineKey === lineKey);
  if (!line) return null;
  const siblings = items.filter((item) => item.productId === line.productId);
  return siblings.length > 1 ? siblings.indexOf(line) + 1 : null;
}
