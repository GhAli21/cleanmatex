# 08 - Pricing Service Express Flag

## Summary

Added `isExpress` to `calculateOrderTotals` so express pricing is applied when the order context indicates express. Callers can pass express via an options object.

## Files Affected

- `web-admin/lib/services/pricing.service.ts`
- `web-admin/app/api/v1/pricing/calculate/route.ts`

## Code Before

```typescript
async calculateOrderTotals(
    tenantId: string,
    items: OrderItemForPricing[],
    customerId?: string,
    orderDiscountPercent = 0,
    orderDiscountAmount = 0
): Promise<OrderTotals> {
    const priceResults = await Promise.all(
        items.map((item) =>
            this.getPriceForOrderItem({
                tenantId,
                productId: item.productId,
                quantity: item.quantity,
                isExpress: false, // TODO: Get from order context
                customerId,
            })
        )
    );
```

## Code After

```typescript
async calculateOrderTotals(
    tenantId: string,
    items: OrderItemForPricing[],
    options: {
        customerId?: string;
        isExpress?: boolean;
        orderDiscountPercent?: number;
        orderDiscountAmount?: number;
    } = {}
): Promise<OrderTotals> {
    const { customerId, isExpress = false, orderDiscountPercent = 0, orderDiscountAmount = 0 } = options;
    const priceResults = await Promise.all(
        items.map((item) =>
            this.getPriceForOrderItem({
                tenantId,
                productId: item.productId,
                quantity: item.quantity,
                isExpress,
                customerId,
            })
        )
    );
```

## API Route Update

The pricing calculate API now passes `isExpress` from the request body:

```typescript
const orderTotals = await pricingService.calculateOrderTotals(
  tenantId,
  items,
  { customerId, isExpress: isExpress || false }
);
```

## Effects

- Breaking: Signature changed from positional args to options object. Only caller was `/api/v1/pricing/calculate` (updated).
- Express orders now use express price list when `isExpress: true` is passed.
