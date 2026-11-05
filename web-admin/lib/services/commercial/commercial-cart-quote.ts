/**
 * Cart view of a checkout quote (Line-Level P5-03, C12).
 *
 * Why: the New Order cart shows the same calculated order the payment modal
 * and submit use. This maps it to the figures the cart displays; it does no
 * arithmetic beyond summing rows the calculator already rounded.
 */
import { toMoney } from '@/lib/commercial';
import { CART_QUOTE_DISCLOSURES, type CartQuoteData, type CartQuoteDisclosure } from '@/lib/types/cart-quote';
import type { CheckoutQuote } from './commercial-checkout.service';

/** Order charge ids start with this owner (`order:<kind>:<code>`, see the loader). */
const ORDER_CHARGE_PREFIX = 'order:';

/**
 * Maps a checkout quote to the cart quote body.
 * @param checkout - The quote from `quoteCheckout` (tenant-scoped by its caller).
 * @param requestId - The client's request id, echoed back.
 * @returns header totals, one entry per cart line (by position), the resolver's ready-by and disclosures
 * @example toCartQuote(await quoteCheckout(params), 'r-1').totals.saleTotal; // 4.62
 */
export function toCartQuote(checkout: CheckoutQuote, requestId: string): CartQuoteData {
  const { totals, quote } = checkout;
  const { result } = quote;
  const n = (value: { toNumber(): number }) => value.toNumber();

  const lines = result.lines.map((line) => {
    // `L{i+1}` is cart position i (`checkoutLineId`).
    const index = Number(line.lineId.slice(1)) - 1;
    const money = line.item.money;
    return {
      index,
      unitPrice: n(money.unitPrice),
      speedPremiumAmount: n(money.speedPremiumAmount),
      includedModifierAmount: n(money.includedModifierAmount),
      grossAmount: n(money.grossAmount),
      lineDiscountAmount: n(money.lineDiscountAmount),
      orderDiscountAllocAmount: n(money.orderDiscountAllocAmount),
      discounts: (line.item.pricing?.adjustments ?? [])
        .filter((a) => !a.amount.isZero())
        .map((a) => ({ source: a.source, rate: a.rate ? n(a.rate) : null, amount: n(a.amount) })),
      netAmount: n(money.netAmount),
      taxAmount: n(money.taxAmount),
      lineTotalAmount: n(money.lineTotalAmount),
      readyByAt: line.readyBy.readyByAt.toISOString(),
      pieces: line.pieces.filter((p) => p.pricing).map((p) => ({
        unitPrice: n(p.money.unitPrice),
        grossAmount: n(p.money.grossAmount),
        lineDiscountAmount: n(p.money.lineDiscountAmount),
        netAmount: n(p.money.netAmount),
      })),
    };
  });

  const disclosures: CartQuoteDisclosure[] = [];
  // L25: an order-wide charge is taxed like the service; say so next to the total.
  const orderChargeTax = result.charges
    .filter((c) => c.chargeId.startsWith(ORDER_CHARGE_PREFIX))
    .reduce((sum, c) => sum.plus(c.taxAmount), toMoney(0));
  if (!orderChargeTax.isZero()) {
    disclosures.push({ code: CART_QUOTE_DISCLOSURES.ORDER_CHARGE_TAXED, amount: n(orderChargeTax) });
  }

  return {
    requestId,
    currencyCode: totals.currencyCode,
    decimalPlaces: totals.decimalPlaces,
    taxPricingMode: quote.facts.pricingMode,
    totals: {
      subtotal: totals.subtotal,
      orderDiscountTotal: n(result.totals.orderDiscountTotal),
      chargesTotal: totals.chargesTotal ?? 0,
      taxTotal: n(result.totals.taxTotal),
      roundingAdjustmentAmount: totals.roundingAdjustmentAmount ?? 0,
      saleTotal: totals.saleTotal,
    },
    lines,
    readyByAt: result.orderReadyBy.toISOString(),
    disclosures,
  };
}
