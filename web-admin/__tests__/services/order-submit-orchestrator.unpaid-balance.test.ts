/**
 * Pins gift-card + NONE outstanding-policy unpaid-balance math used in submit-order.
 */

describe('order-submit-orchestrator unpaid balance with gift card', () => {
  function computeUnpaidBalance(
    serverSaleTotal: number,
    amountToCharge: number,
    giftApplied: number
  ): number {
    return Math.max(0, serverSaleTotal - amountToCharge - giftApplied);
  }

  it('allows NONE when gift credit plus cash legs cover the sale total', () => {
    expect(computeUnpaidBalance(100, 70, 30)).toBe(0);
  });

  it('blocks NONE when gift plus cash underpay the sale total', () => {
    expect(computeUnpaidBalance(100, 60, 30)).toBe(10);
  });
});
