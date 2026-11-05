/**
 * Item price confirmation (Reusable Order Fin View D26, Line-Level P5-03d).
 *
 * Why: the server is the only price authority, and the cashier must never be
 * charged a unit price they were not shown. Each submitted line can carry the
 * `confirmedUnitPrice` the cart showed; the server never uses it to price,
 * only compares it with the unit price it just calculated. A difference
 * (a price list edited, a price-list discount expired, a speed rule changed
 * between the cart and submit) rejects the submit with the lines that moved,
 * and nothing is saved. A cashier price override is honoured as entered and
 * is never a difference.
 */
import { toMoney, type CommercialOrderResult, type Money } from '@/lib/commercial';
import type { CheckoutQuote } from './commercial-checkout.service';

/** The error code a changed price is rejected with. */
export const PRICE_CHANGED = 'PRICE_CHANGED';

/** One line whose unit price changed between the cart and submit. */
export interface PriceChangedLine {
  /** The cart position (line `L{index+1}`). */
  index: number;
  /** Null for a custom item. */
  productId: string | null;
  shownUnitPrice: number;
  currentUnitPrice: number;
}

/** Thrown before anything is written; the submit route answers 409 with `lines`. */
export class PriceChangedError extends Error {
  readonly code = PRICE_CHANGED;
  constructor(readonly lines: PriceChangedLine[]) {
    super(PRICE_CHANGED);
    this.name = 'PriceChangedError';
  }
}

/** A submitted line as far as the confirmation reads it. */
export interface ConfirmedLine {
  productId?: string | null;
  priceOverride?: number | null;
  /** The unit price the cart showed; absent from a client that does not send it (totals guard only). */
  confirmedUnitPrice?: number | null;
}

/**
 * Lists the lines whose calculated unit price differs from the price the cart showed.
 * A difference smaller than half a minor unit of the currency is the same price (B15).
 * @param lines - The submitted lines, in cart order.
 * @param checkout - The checkout quote the submit was priced with.
 * @returns the changed lines (empty when every shown price still holds)
 * @example findPriceChanges([{ productId: 'p', confirmedUnitPrice: 2 }], checkout); // [] or [{ index: 0, … }]
 */
export function findPriceChanges(lines: readonly ConfirmedLine[], checkout: CheckoutQuote): PriceChangedLine[] {
  // A client that sends no shown prices keeps the totals guard only (D26 "Channels").
  if (!lines.some((line) => line.confirmedUnitPrice != null)) return [];
  const { result } = checkout.quote;
  return lines.flatMap((line, index) => {
    if (line.confirmedUnitPrice == null || line.priceOverride != null) return [];
    const current = result.lines[index]?.item.money.unitPrice;
    if (!current) return [];
    const shown = toMoney(line.confirmedUnitPrice);
    if (samePrice(shown, current, result.decimalPlaces)) return [];
    return [{ index, productId: line.productId ?? null, shownUnitPrice: shown.toNumber(), currentUnitPrice: current.toNumber() }];
  });
}

/** One added Order Edit line whose calculated unit price is not the one the cart showed (P6-02e). */
export interface EditPriceChangedLine {
  /** The `ADD_ITEM` operation. */
  seq: number;
  orderItemId: string;
  shownUnitPrice: number;
  currentUnitPrice: number;
}

/**
 * Order Edit's price confirmation (P1B-14 Edit part). Preview is the quote, so a
 * difference does not reject it: Review lists the lines, and the review proof
 * locks the reviewed prices for Apply.
 * @param lines - The added lines that carry the price the cart showed (no override, no custom item).
 * @param result - The calculated order behind the Preview.
 * @returns the lines whose price changed
 * @example findEditPriceChanges([{ seq: 1, orderItemId: 'c', confirmedUnitPrice: '2.0000' }], result);
 */
export function findEditPriceChanges(
  lines: readonly { seq: number; orderItemId: string; confirmedUnitPrice: string }[],
  result: CommercialOrderResult,
): EditPriceChangedLine[] {
  return lines.flatMap((line) => {
    const current = result.lines.find((calculated) => calculated.lineId.toLowerCase() === line.orderItemId.toLowerCase())?.item.money.unitPrice;
    if (!current) return [];
    const shown = toMoney(line.confirmedUnitPrice);
    if (samePrice(shown, current, result.decimalPlaces)) return [];
    return [{ seq: line.seq, orderItemId: line.orderItemId, shownUnitPrice: shown.toNumber(), currentUnitPrice: current.toNumber() }];
  });
}

/** A difference smaller than half a minor unit of the currency is the same price (B15). */
function samePrice(shown: Money, current: Money, decimalPlaces: number): boolean {
  return shown.minus(current).abs().lessThan(toMoney(0.5).div(toMoney(10).pow(decimalPlaces)));
}
