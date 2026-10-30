/**
 * D26 (Line-Level P5-03d): a unit price the cart showed is compared with the
 * one the server calculated; it is never used to price.
 */
import { toMoney } from '@/lib/commercial';
import { findPriceChanges, PriceChangedError } from '@/lib/services/commercial/price-confirmation';
import type { CheckoutQuote } from '@/lib/services/commercial/commercial-checkout.service';

const checkout = (unitPrices: number[], decimalPlaces = 3) => ({
  quote: { result: { decimalPlaces, lines: unitPrices.map((p) => ({ item: { money: { unitPrice: toMoney(p) } } })) } },
}) as unknown as CheckoutQuote;

describe('findPriceChanges (D26)', () => {
  it('no change when every shown price still holds, within half a minor unit (B15)', () => {
    expect(findPriceChanges([{ productId: 'a', confirmedUnitPrice: 2 }, { productId: 'b', confirmedUnitPrice: 1.5004 }], checkout([2, 1.5]))).toEqual([]);
  });

  it('lists each changed line with the shown and current price', () => {
    const changes = findPriceChanges(
      [{ productId: 'a', confirmedUnitPrice: 2 }, { productId: 'b', confirmedUnitPrice: 1.5 }],
      checkout([2.5, 1.5]),
    );
    expect(changes).toEqual([{ index: 0, productId: 'a', shownUnitPrice: 2, currentUnitPrice: 2.5 }]);
    expect(new PriceChangedError(changes)).toMatchObject({ code: 'PRICE_CHANGED', lines: changes });
  });

  it('a cashier override is honoured as entered, and a line without a shown price is not compared', () => {
    expect(findPriceChanges(
      [{ productId: 'a', priceOverride: 1, confirmedUnitPrice: 9 }, { productId: 'b' }, { productId: 'c', confirmedUnitPrice: null }],
      checkout([1, 7, 7]),
    )).toEqual([]);
  });
});
