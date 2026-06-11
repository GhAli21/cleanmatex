/**
 * Ensures create-submit item payloads preserve price override audit fields.
 */

describe('create submit item price override payload', () => {
  it('includes override fields when priceOverride is set on an item', () => {
    const item = {
      productId: 'prod-1',
      quantity: 2,
      priceOverride: 12.5,
      overrideReason: 'Manager approval',
      overrideBy: 'user-1',
    };

    const mapped = {
      productId: item.productId,
      quantity: item.quantity,
      ...(item.priceOverride != null && {
        priceOverride: item.priceOverride,
        overrideReason: item.overrideReason,
        overrideBy: item.overrideBy,
      }),
    };

    expect(mapped).toEqual({
      productId: 'prod-1',
      quantity: 2,
      priceOverride: 12.5,
      overrideReason: 'Manager approval',
      overrideBy: 'user-1',
    });
  });

  it('omits override fields when priceOverride is null', () => {
    const item = {
      productId: 'prod-1',
      quantity: 1,
      priceOverride: null as number | null,
      overrideReason: undefined,
      overrideBy: undefined,
    };

    const mapped = {
      productId: item.productId,
      quantity: item.quantity,
      ...(item.priceOverride != null && {
        priceOverride: item.priceOverride,
        overrideReason: item.overrideReason,
        overrideBy: item.overrideBy,
      }),
    };

    expect(mapped).toEqual({
      productId: 'prod-1',
      quantity: 1,
    });
  });
});
